# @mykks32/pagination-cursor

A flat REST envelope (`{ data, meta, links }`) for cursor-based pagination
— an adapter on top of [`@mykks32/pagination-relay`](../pagination-relay),
not a second pagination engine. It takes relay's native
`{ edges, pageInfo }` output and reshapes it into the response shape most
REST APIs actually expect, plus the query-string plumbing (a generic DTO,
sparse fieldsets, ad-hoc filters) to go with it.

See [`apps/notes-api`](../../apps/notes-api)'s `GET /v2/notes` for this
package used end to end against a real Mongoose model.

## Why this exists (and why it isn't part of `pagination-relay`)

Relay's `edges`/`node`/`cursor` shape is a real, useful spec — but it's a
*GraphQL* spec. Most REST API consumers don't expect (or want) a `node`
wrapper around every item; they expect a plain array. Keeping the reshaping
in a separate package means:

- `pagination-relay` stays usable as-is for GraphQL resolvers, with zero
  REST opinions baked in.
- This package can evolve its REST conventions (`meta`/`links` shape,
  sparse fieldsets, filter query-string encoding) independently, without
  touching the actual seek-filter/cursor engine underneath.

## When to use this vs. the other two packages

- **Pick this package** when you want cursor pagination's scalability (no
  `skip()` cost, stable results under concurrent writes) exposed as a
  conventional REST list endpoint — most public/external REST APIs land
  here.
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
pnpm add @mykks32/pagination-cursor @mykks32/pagination-relay
```

`@mykks32/pagination-relay`, `class-transformer`, `class-validator`, and
`reflect-metadata` are peer dependencies. `pagination-relay` is a *real*
dependency here (not just a peer for version alignment) — this package's
whole job is reshaping its output.

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

In the controller, call `@mykks32/pagination-relay`'s `paginate()` as
usual, then hand its result to `toPaginatedResponse()` along with your
mapped `data` array:

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
    const page = await this.notesService.findAll(query); // returns @mykks32/pagination-relay's PaginatedResult<Note>

    const data = page.edges.map((edge) => applyFieldSelection(edge.node, query.include, query.exclude));

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

### Ad-hoc `filters` — sanitize before use

`CursorPaginationDto.filters` is a generic `Record<string, unknown>`
parsed from JSON in the query string. **Never merge it straight into a
Mongo filter** — whitelist it first:

```ts
const ALLOWED_FILTER_FIELDS = ['title', 'tags', 'archived'];

function sanitizeFilters(filters?: Record<string, unknown>) {
  if (!filters) return {};
  for (const [field, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTER_FIELDS.includes(field)) throw new BadRequestException(`"${field}" is not filterable.`);
    if (typeof value === 'object') throw new BadRequestException(`"${field}" can't be an object.`); // blocks {"$where": "..."} etc.
  }
  return filters;
}
```

(`apps/notes-api`'s `NotesService` has the full version of this.)

## File structure

```
src/
├── index.ts                              # public API barrel
├── dto/
│   └── cursor-pagination.dto.ts          # CursorPaginationDto — generic query shape, extend per resource
├── serializers/
│   ├── paginated-meta.serializer.ts      # PaginatedMetaSerializer
│   ├── paginated-links.serializer.ts     # PaginatedLinksSerializer
│   └── paginated-response.serializer.ts  # PaginatedResponseSerializer<T> — the { data, meta, links } envelope
├── utils/
│   ├── pagination-links.util.ts          # buildPaginatedLinks()
│   └── field-selection.util.ts           # applyFieldSelection()
└── to-paginated-response.util.ts         # toPaginatedResponse() — the one call a controller needs

test/                                      # mirrors src/
```

Design principles:
- **`serializers/`, not `dto/`, for output shapes.** `dto/` is exclusively
  for validated *input* (`CursorPaginationDto`, parsed via
  `class-validator`); the response envelope classes are output-only and
  live separately, decorated with `class-transformer`'s `@Expose()`/`@Type()`
  so they participate correctly in a consuming app's global
  `ClassSerializerInterceptor` — see "Why classes, not interfaces" below.
- **No database access anywhere in this package.** It only ever reshapes
  values `pagination-relay` already computed; there's no `mongo/` folder
  here because there's no query logic to put in one.
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

## Development

```bash
pnpm --filter @mykks32/pagination-cursor test
pnpm --filter @mykks32/pagination-cursor test:cov
pnpm --filter @mykks32/pagination-cursor lint
pnpm --filter @mykks32/pagination-cursor format
pnpm --filter @mykks32/pagination-cursor build    # tsup -> dist/ (dual CJS/ESM)
```
