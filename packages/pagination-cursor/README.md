# @mykks32/pagination-cursor

A flat REST envelope (`{ data, meta, links }`) for cursor-based
pagination, backed by its **own** Mongo keyset ("seek method") paginator —
standalone, with **no dependency on
[`@mykks32/pagination-relay`](../pagination-relay)** or any other package
in this monorepo. This is not a reshape of relay's output: `paginate()`
below queries Mongoose directly and produces its own `{ rows, pageInfo }`,
independently of whatever `pagination-relay` does.

See [`apps/notes-api`](../../apps/notes-api)'s `GET /v2/notes` for this
package's Mongo engine used end to end against a real Mongoose model,
running side by side with (and entirely independent of) v1's
`pagination-relay`-backed engine.

## Why this exists as its own package

Relay's `edges`/`node`/`cursor` shape is a real, useful spec — but it's a
*GraphQL* spec. Most REST API consumers don't expect (or want) a `node`
wrapper around every item; they expect a plain array. Keeping the reshaping
*and* the Mongo query logic in a separate, dependency-free package means:

- This package can evolve its REST conventions (`meta`/`links` shape,
  sparse fieldsets, filter query-string encoding, sort/filter whitelisting)
  independently, with zero coupling to any other package's release cycle.
- Consumers who only want the REST convention pick this package; consumers
  who want the Relay connection shape pick `pagination-relay` — neither
  waits on, or depends on, the other's Mongo engine.
- Following the same principle `pagination-offset` already applies to its
  own `sort.util.ts`: a small amount of duplicated logic (this package's
  `src/mongo/`/`src/utils/cursor.util.ts` mirror `pagination-relay`'s
  seek-filter/cursor-encoding implementation) is cheaper than a
  compile-time dependency between two packages meant to be usable alone.

## When to use this vs. the other two packages

- **Pick this package** when you want cursor pagination's scalability (no
  `skip()` cost, stable results under concurrent writes) exposed as a
  conventional REST list endpoint — most public/external REST APIs land
  here. Pair it with `pagination-relay`'s Mongo paginator (or your own) to
  actually produce the `PageInfo`/rows it reshapes.
- **Pick `pagination-relay` directly** if you're building GraphQL, or you
  specifically want the Relay connection shape.
- **Pick `pagination-offset`** if clients need page-number navigation
  (`page=3`, "jump to page 8 of 20") — no cursor-based approach, this
  package included, can offer that.

## Install

Published to **GitHub Packages**, not the public npm registry. See
`@mykks32/pagination-relay`'s README for the `.npmrc` setup — same registry,
same scope.

```bash
pnpm add @mykks32/pagination-cursor
```

`@nestjs/common`, `class-transformer`, `class-validator`, `mongoose`, and
`reflect-metadata` are peer dependencies. No other package in this
monorepo is a dependency, peer or otherwise.

## How to use it

Extend the generic query DTO with whatever's specific to your resource
(here, `includeArchived`):

```ts
import { CursorPaginationDto } from '@mykks32/pagination-cursor';
import { IsOptional, IsBoolean } from 'class-validator';

export class ListNotesQueryDto extends CursorPaginationDto {
  @IsOptional()
  @IsBoolean()
  includeArchived?: boolean;
}
```

In a Nest provider, inject `MongoCursorPaginationService` and call
`.paginate()` against your Mongoose model — this runs this package's own
Mongo keyset engine, not `pagination-relay`'s:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { MongoCursorPaginationService } from '@mykks32/pagination-cursor';
import type { Model } from 'mongoose';
import { Note } from './note.schema';

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<Note>,
    private readonly paginationService: MongoCursorPaginationService,
  ) {}

  findAll(query: ListNotesQueryDto) {
    const { first, after, last, before } = query;
    return this.paginationService.paginate(this.noteModel, {
      args: { first, after, last, before },
      sort: [{ field: 'createdAt', direction: 'DESC' }],
      filter: { archived: false },
      includeTotalCount: true,
    }); // => CursorPage<Note>: { rows, pageInfo, totalCount }
  }
}
```

Then in the controller, hand the `CursorPage` to `toPaginatedResponse()`
along with your mapped `data` array:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { applyFieldSelection, toPaginatedResponse } from '@mykks32/pagination-cursor';
import { NotesService } from './notes.service';
import { ListNotesQueryDto } from './list-notes-query.dto';
import { NoteSerializer } from './note.serializer';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  async findAll(@Query() query: ListNotesQueryDto) {
    const page = await this.notesService.findAll(query); // CursorPage<Note>: { rows, pageInfo, totalCount }

    const data = page.rows.map((row) => applyFieldSelection(row, query.include, query.exclude));

    return toPaginatedResponse('/v1/notes', query, page.pageInfo, data, page.totalCount);
  }
}
```

`GET /v1/notes?first=10` then returns:

```json
{
  "data": [{ "id": "...", "title": "..." }],
  "meta": {
    "count": 42,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "opaque-string",
    "endCursor": "opaque-string"
  },
  "links": {
    "self": "/v1/notes?first=10",
    "previous": null,
    "next": "/v1/notes?first=10&after=opaque-string"
  }
}
```

`links` are built from the *same* query params the request came in with —
`search`/`sort`/`filters`/etc. all survive onto `next`/`previous`
automatically, so a client can follow `links.next` verbatim without
reconstructing the query string itself.

### `include`/`exclude` (sparse fieldsets)

```ts
applyFieldSelection({ id: '1', title: 'Note', content: 'Body', archived: false }, ['title']);
// => { id: '1', title: 'Note' }
```

Applied to the *already-serialized* response object, not the database
projection — so the sort/cursor fields are always fetched (cursor encoding
needs them), and only the client-facing shape is narrowed.

### Sort/filter resolution — whitelist before it reaches your query

`CursorPaginationDto.sort`/`.order`/`.filters` are free-form (`filters` is a
generic `Record<string, unknown>` parsed from JSON in the query string).
**Never merge `filters` straight into a Mongo filter, and never sort on an
unvalidated field** — this package ships the whitelisting so every consumer
doesn't have to hand-roll it:

```ts
import { resolveSort, sanitizeFilters } from '@mykks32/pagination-cursor';

const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
const FILTERABLE_FIELDS = ['title', 'tags', 'archived'] as const;

const sort = resolveSort(query, SORTABLE_FIELDS, 'createdAt'); // throws InvalidSortFieldException if query.sort isn't whitelisted
const filters = sanitizeFilters(query.filters, FILTERABLE_FIELDS); // throws InvalidFilterException on an unknown key or a non-primitive value (blocks {"$where": "..."} etc.)
```

Both exceptions extend Nest's `BadRequestException`, so they translate to
an HTTP 400 automatically inside a request context.

## File structure

```
src/
├── index.ts                                # public API barrel
├── constants/
│   └── pagination.constants.ts             # DEFAULT_SORT_DIRECTION, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, ID_FIELD, CURSOR_VERSION
├── errors/
│   └── pagination.errors.ts                # InvalidSortFieldException, InvalidFilterException, InvalidCursorException, InvalidPaginationArgsException
├── interfaces/
│   ├── pagination.interface.ts             # SortField, SortDirection, PageInfo, CursorPaginationArgs, CursorPage<T>
│   └── mongo-cursor-pagination-options.interface.ts  # MongoCursorPaginationOptions<T>
├── dto/
│   └── cursor-pagination.dto.ts            # CursorPaginationDto — generic query shape, extend per resource
├── serializers/
│   ├── paginated-meta.serializer.ts        # PaginatedMetaSerializer
│   ├── paginated-links.serializer.ts       # PaginatedLinksSerializer
│   └── paginated-response.serializer.ts    # PaginatedResponseSerializer<T> — the { data, meta, links } envelope
├── utils/
│   ├── pagination-links.util.ts            # buildPaginatedLinks()
│   ├── field-selection.util.ts             # applyFieldSelection()
│   ├── sort-resolution.util.ts             # resolveSort() / resolveSortField() / resolveSortDirection() — query-param whitelisting
│   ├── filter-sanitizer.util.ts            # sanitizeFilters()
│   ├── cursor.util.ts                      # encodeCursor() / decodeCursor() — opaque cursor (de)serialization
│   └── mongo-sort.util.ts                  # normalizeSortFields() / toMongoSortObject() / invertSort() — compound-sort mechanics
├── mongo/
│   ├── mongo-seek-filter.builder.ts        # buildSeekFilter() — the keyset filter itself
│   ├── mongo-cursor-paginator.ts           # paginate() — framework-agnostic, Mongoose-only
│   └── mongo-cursor-pagination.service.ts  # MongoCursorPaginationService — injectable Nest wrapper around paginate()
└── to-paginated-response.util.ts           # toPaginatedResponse() — the one call a controller needs

test/                                        # mirrors src/
```

Design principles:
- **`serializers/`, not `dto/`, for output shapes.** `dto/` is exclusively
  for validated *input* (`CursorPaginationDto`, parsed via
  `class-validator`); the response envelope classes are output-only and
  live separately, decorated with `class-transformer`'s `@Expose()`/`@Type()`
  so they participate correctly in a consuming app's global
  `ClassSerializerInterceptor` — see "Why classes, not interfaces" below.
- **`mongo/` exists here too, not just in `pagination-relay`.** Earlier
  versions of this package had no Mongo logic at all and only reshaped a
  `PageInfo` computed elsewhere; it now runs its own keyset paginator so
  v1 (relay) and v2 (this package) in `apps/notes-api` are genuinely
  independent engines, not two views of one query.
- **`interfaces/pagination.interface.ts`'s `SortField`/`SortDirection`/`PageInfo`
  are standalone copies, not an import, of `@mykks32/pagination-relay`'s
  shapes of the same name.** This package has zero dependency on any other
  package here — see "Why this exists as its own package" above.
- **`paginate()` returns `rows: T[]`, not `edges: Edge<T>[]`.** No
  Relay-style `node`/`cursor` wrapping anywhere in this package's output —
  `startCursor`/`endCursor` in `pageInfo` are derived from the first/last
  row's own sort-field values instead of a per-row `edge.cursor`.
- **`data`'s generic type `T` is deliberately not `@Type()`-annotated** —
  class-transformer only needs `@Type()` to know what class to *construct*
  during a plain→class pass; these response classes are only ever built
  directly (via `toPaginatedResponse()`) and serialized class→plain, so
  each item in `data` already carries its own type/decorators by the time
  serialization happens.

### Why classes, not interfaces, for `meta`/`links`/the envelope

An earlier version of this package used plain TypeScript `interface`s for
these shapes. That's fine for compile-time typing, but it means the actual
object returned from a controller is a bare object literal with no runtime
identity — which matters once a consuming Nest app's global
`ClassSerializerInterceptor` is in the picture: it only knows how to apply
`@Expose()`/`@Exclude()` to real class instances. Interfaces are erased at
compile time; they can't carry that metadata. Real classes (as used now)
serialize consistently through the same mechanism every other response DTO
in a Nest app already goes through, instead of being a special case.

## Testing note: `reflect-metadata` in this package's own test run

The serializer classes use `@Type(() => X)`, which needs the
`Reflect.getMetadata` polyfill. In a real app, that comes from `main.ts`'s
`import 'reflect-metadata'` (loaded once, process-wide) — but this
package's own isolated `jest` run has no such app to rely on, so its
`jest.config.js` loads the polyfill itself via `setupFiles: ['reflect-metadata']`.
If you add a new `@Type()`-decorated class and its test throws
`Reflect.getMetadata is not a function`, this is why.

## API reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `CursorPaginationDto` | class (input) | Generic `first`/`last`/`after`/`before`/`search`/`sort`/`order`/`include`/`exclude`/`filters` query shape |
| `PaginatedResponseSerializer<T>` | class (output) | The `{ data, meta, links }` envelope |
| `PaginatedMetaSerializer` / `PaginatedLinksSerializer` | classes (output) | `meta`/`links` sub-shapes |
| `toPaginatedResponse(basePath, query, pageInfo, data, totalCount?)` | function | Assembles the full envelope — the one call most controllers need |
| `buildPaginatedLinks(basePath, query, pageInfo)` | function | Just the `links` object, for callers assembling the envelope by hand |
| `applyFieldSelection(item, include?, exclude?)` | function | Sparse fieldset narrowing |
| `resolveSort(query, allowedFields, defaultField)` | function | Whitelists `sort`/`order` into a `SortField`, throwing `InvalidSortFieldException` otherwise |
| `resolveSortField(field, allowedFields, defaultField)` / `resolveSortDirection(order)` | functions | The two halves of `resolveSort`, for callers who only need one |
| `sanitizeFilters(filters, allowedFields)` | function | Whitelists an ad-hoc `filters` object to primitive-only values, throwing `InvalidFilterException` otherwise |
| `InvalidSortFieldException` / `InvalidFilterException` | classes (error) | Thrown by the two resolvers above; both extend Nest's `BadRequestException` |
| `SortField` / `SortDirection` / `PageInfo` | types | Standalone copies of `pagination-relay`'s shapes of the same name |
| `MongoCursorPaginationService` | injectable class | `.paginate(model, options)` — this package's own Mongo keyset paginator, returning `CursorPage<T>` (`{ rows, pageInfo, totalCount? }`) |
| `CursorPaginationArgs` / `CursorPage<T>` | types | `{ first?, after?, last?, before? }` args and the paginator's result shape |
| `InvalidCursorException` / `InvalidPaginationArgsException` | classes (error) | Thrown by the Mongo paginator for a malformed cursor or a self-contradictory `first`/`last`/`after`/`before` combination |
| `encodeCursor(values)` / `decodeCursor(cursor)` | functions | Opaque, URL-safe cursor (de)serialization |
| `buildSeekFilter(sort, cursorValues, direction)` | function | The keyset ("seek method") Mongo filter itself, for callers assembling a query by hand |

## Development

```bash
pnpm --filter @mykks32/pagination-cursor test
pnpm --filter @mykks32/pagination-cursor test:cov
pnpm --filter @mykks32/pagination-cursor lint
pnpm --filter @mykks32/pagination-cursor format
pnpm --filter @mykks32/pagination-cursor build    # tsup -> dist/ (dual CJS/ESM)
```
