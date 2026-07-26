# @mykks32/pagination-offset

Classic page/limit ("offset") pagination for NestJS + Mongoose, with a
`{ data, meta, links }` REST envelope built in. Unlike
[`@mykks32/pagination-cursor`](../pagination-cursor), this package is
**fully self-contained** — it doesn't depend on
[`@mykks32/pagination-relay`](../pagination-relay) at all. Offset
pagination's query logic (`skip`/`limit` + `countDocuments`) is
architecturally unrelated to cursor/seek-filter logic, so there's no
"engine" to share between them.

See [`apps/notes-api`](../../apps/notes-api)'s `GET /v3/notes` for this
package used end to end against a real Mongoose model.

## Why (and why not) offset pagination

`skip`/`limit` has two well-known costs that get worse as a collection
grows: the database still has to walk and discard every skipped document
(so `skip(10000)` is slower than `skip(10)`), and results can shift
(duplicate or skip rows) if the collection changes between page requests.
Cursor pagination (`pagination-relay`/`pagination-cursor`) exists
specifically to avoid both. So why does this package exist at all?

**Because only offset pagination can answer "what page am I on, and how
many are there."** A cursor is opaque and only ever points relative to one
row — there's no such thing as "page 8" when all you have is
`after: 'eyJ2IjoxLCJ2YWx1ZXMi...'`. If your UI needs any of:

- Page-number navigation (`1 2 3 ... 8`, "jump to page 5")
- "Showing 21–40 of 156"
- Reliable direct linking to an arbitrary page (`?page=5`, bookmarkable,
  shareable, browser-back-button-safe in a way an opaque cursor chain isn't)

...cursor pagination structurally cannot provide it, no matter which of
the other two packages you use. This package trades away cursor
pagination's scalability guarantees to get those features back — a
`countDocuments` runs on *every* request (not opt-in, unlike
`pagination-relay`'s `includeTotalCount`), because `totalPages` and
`links.last` are core to what this package promises.

## When to use this vs. the other two packages

- **Pick this package** for admin dashboards, data tables, and any UI where
  a user picks a page number rather than clicking "next" — the common case
  in practice despite cursor pagination's better Big-O.
- **Pick `pagination-cursor`** for public/external REST APIs at real scale
  (deep pagination, high write concurrency) where the `countDocuments` +
  `skip()` cost of this package would actually matter.
- **Pick `pagination-relay`** directly if you're building GraphQL.

## Install

Published to **GitHub Packages**, not the public npm registry. See
`@mykks32/pagination-relay`'s README for the `.npmrc` setup — same registry,
same scope.

```bash
pnpm add @mykks32/pagination-offset
```

`@nestjs/common`, `mongoose`, `class-transformer`, `class-validator`, and
`reflect-metadata` are peer dependencies.

## How to use it

Register `MongoOffsetPaginationService` as a provider and inject it like
any other Nest service:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoOffsetPaginationService, OffsetPaginationArgs } from '@mykks32/pagination-offset';
import { User } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly offsetPaginationService: MongoOffsetPaginationService,
  ) {}

  findUsers(args: OffsetPaginationArgs) {
    return this.offsetPaginationService.paginate(this.userModel, {
      args,
      sort: [{ field: 'createdAt', direction: 'DESC' }],
      filter: { deletedAt: null },
    });
  }
}
```

```ts
@Module({
  providers: [MongoOffsetPaginationService, UsersService],
})
export class UsersModule {}
```

Extend the generic query DTO with whatever's resource-specific:

```ts
import { OffsetPaginationDto } from '@mykks32/pagination-offset';
import { IsOptional, IsBoolean } from 'class-validator';

export class ListUsersQueryDto extends OffsetPaginationDto {
  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean;
}
```

In the controller, assemble the full envelope with `toOffsetPaginatedResponse()`:

```ts
import { Controller, Get, Query } from '@nestjs/common';
import { toOffsetPaginatedResponse } from '@mykks32/pagination-offset';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './list-users-query.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(@Query() query: ListUsersQueryDto) {
    const page = await this.usersService.findUsers(query); // { data, meta }
    return toOffsetPaginatedResponse('/users', query, page);
  }
}
```

`GET /users?page=2&limit=20` then returns:

```json
{
  "data": [{ "id": "...", "name": "..." }],
  "meta": {
    "page": 2,
    "limit": 20,
    "count": 20,
    "totalItems": 156,
    "totalPages": 8,
    "hasPreviousPage": true,
    "hasNextPage": true
  },
  "links": {
    "self": "/users?limit=20&page=2",
    "first": "/users?limit=20&page=1",
    "previous": "/users?limit=20&page=1",
    "next": "/users?limit=20&page=3",
    "last": "/users?limit=20&page=8"
  }
}
```

Note `meta.count` (items actually in *this* page, `data.length`) vs.
`meta.totalItems` (matching the query, across every page) — easy to
conflate, and this package deliberately reports both since UIs usually
need both ("20 of 156").

`links.first`/`links.last` are **never `null`**, unlike `previous`/`next` —
re-requesting the page you're already on is a harmless no-op, not an
invalid request, so clients can always render first/last-page controls
without conditional logic.

## File structure

```
src/
├── index.ts                                       # public API barrel
├── constants/
│   └── pagination.constants.ts                    # DEFAULT_PAGE, DEFAULT_LIMIT, MAX_LIMIT
├── errors/
│   └── pagination.errors.ts                        # InvalidOffsetPaginationArgsException
├── interfaces/
│   ├── pagination.interface.ts                     # SortField, OffsetPaginationArgs (input-side contracts only)
│   └── mongo-offset-pagination-options.interface.ts # MongoOffsetPaginationOptions<T>
├── dto/
│   └── offset-pagination.dto.ts                    # OffsetPaginationDto — generic query shape, extend per resource
├── serializers/
│   ├── offset-page-meta.serializer.ts              # OffsetPageMetaSerializer
│   ├── offset-paginated-links.serializer.ts        # OffsetPaginatedLinksSerializer
│   └── offset-paginated-response.serializer.ts     # OffsetPaginatedResponseSerializer<T>
├── utils/
│   ├── sort.util.ts                                # sort normalization + _id tiebreaker (standalone copy — see below)
│   └── offset-links.util.ts                        # buildOffsetLinks()
├── mongo/
│   ├── mongo-offset-paginator.ts                   # framework-agnostic paginate(): skip/limit + countDocuments
│   └── mongo-offset-pagination.service.ts          # @Injectable Nest wrapper around paginate()
└── to-offset-paginated-response.util.ts            # toOffsetPaginatedResponse() — the one call a controller needs

test/                                                # mirrors src/
```

Design principles:
- **One cohesive package, not split into engine + adapter** (unlike
  relay/cursor). Offset pagination doesn't have a meaningful
  transport-agnostic "core" separate from its REST envelope the way cursor
  pagination does — `totalPages`/`links` are practically definitional to
  what offset pagination *is*, not an optional reshaping on top. So
  `mongo-offset-paginator.ts`'s `paginate()` constructs
  `OffsetPageMetaSerializer` instances directly, rather than returning a
  plain shape for some other package to wrap later.
- **`sort.util.ts` is a deliberately standalone copy**, not imported from
  `pagination-relay` — despite the near-identical logic (normalize +
  tiebreak + convert to Mongo's sort object shape), sharing it would create
  a real dependency between two packages that are supposed to be
  independent pagination *strategies*. ~15 lines of duplication is cheaper
  than that coupling.
- **`serializers/`, not `dto/`, for output shapes** — same convention as
  `pagination-cursor`: `dto/` is input only (`OffsetPaginationDto`,
  validated by `class-validator`); response shapes are
  `class-transformer`-decorated classes so a consuming app's global
  `ClassSerializerInterceptor` can serialize them like any other response
  DTO.

## Testing note: `reflect-metadata` in this package's own test run

Same as `pagination-cursor`: the serializer classes use `@Type(() => X)`,
which needs `Reflect.getMetadata`. This package's `jest.config.js` loads
the polyfill itself via `setupFiles: ['reflect-metadata']` so its isolated
test run doesn't need a real Nest app's `main.ts` to provide it.

## API reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `OffsetPaginationDto` | class (input) | Generic `page`/`limit`/`search`/`sort`/`order`/`include`/`exclude`/`filters` query shape |
| `MongoOffsetPaginationService` | `@Injectable` class | Nest DI wrapper around `paginate` |
| `paginate<T>(model, options)` | function | Core offset pagination, framework-agnostic |
| `OffsetPaginatedResponseSerializer<T>` | class (output) | The `{ data, meta, links }` envelope |
| `OffsetPageMetaSerializer` / `OffsetPaginatedLinksSerializer` | classes (output) | `meta`/`links` sub-shapes |
| `toOffsetPaginatedResponse(basePath, query, page)` | function | Assembles the full envelope from an `OffsetPage` |
| `buildOffsetLinks(basePath, query, meta)` | function | Just the `links` object |
| `InvalidOffsetPaginationArgsException` | `BadRequestException` subclass | Thrown on non-positive `page`/`limit` |
| `DEFAULT_PAGE`, `DEFAULT_LIMIT`, `MAX_LIMIT` | constants | Tunable defaults |

## Development

```bash
pnpm --filter @mykks32/pagination-offset test
pnpm --filter @mykks32/pagination-offset test:cov
pnpm --filter @mykks32/pagination-offset lint
pnpm --filter @mykks32/pagination-offset format
pnpm --filter @mykks32/pagination-offset build    # tsup -> dist/ (dual CJS/ESM)
```
