# @mykks32/pagination

Cursor (keyset/seek) pagination for NestJS applications.

Supported:
- MongoDB / Mongoose (v1)
- TypeORM (v2, planned)

See [`apps/notes-api`](../../apps/notes-api) in this monorepo for a full working example (a Notes CRUD API built on top of this package).

## Why cursor pagination

Offset pagination (`skip`/`limit`) gets slower as the offset grows (the
database still has to walk and discard every skipped document) and produces
duplicate or missing rows when items are inserted/removed between page
requests. Cursor pagination instead "seeks" from the last row's sort key
using indexed range queries (`$gt`/`$lt`), so every page is a constant-time
lookup against the same compound index, and results stay stable under
concurrent writes.

## Install

```bash
pnpm add @mykks32/pagination
```

`@nestjs/common` and `mongoose` are peer dependencies — install whichever
versions your app already uses.

## File structure

```
src/
├── index.ts                                        # public API barrel
├── constants/
│   └── pagination.constants.ts                     # default/max page size, cursor version
├── errors/
│   └── pagination.errors.ts                         # InvalidCursorException, InvalidPaginationArgsException
├── interfaces/
│   ├── pagination.interface.ts                      # SortField, CursorPaginationArgs, PageInfo, Edge, PaginatedResult
│   └── mongo-cursor-pagination-options.interface.ts # MongoCursorPaginationOptions<T>
├── utils/
│   ├── cursor.util.ts                                # encode/decode opaque cursors
│   └── sort.util.ts                                  # sort normalization + _id tiebreaker
└── mongo/
    ├── mongo-seek-filter.builder.ts                  # pure keyset $or filter builder
    ├── mongo-cursor-paginator.ts                      # framework-agnostic paginate() function
    └── mongo-cursor-pagination.service.ts             # @Injectable Nest wrapper around paginate()

test/                                                  # mirrors src/, one *.spec.ts per source file
├── utils/
│   ├── cursor.util.spec.ts
│   └── sort.util.spec.ts
└── mongo/
    ├── mongo-seek-filter.builder.spec.ts
    └── mongo-cursor-paginator.spec.ts
```

Design principles behind the layout:
- **Framework-agnostic core, thin Nest adapter.** `paginate()` only imports
  from `mongoose`; it has no Nest dependency and can be unit tested without
  a Nest application context. `MongoCursorPaginationService` is a one-method
  `@Injectable` wrapper for DI-based consumption.
- **One concern per file.** Encoding, sort handling, filter building, and
  orchestration are separate modules so each is independently testable.
- **Tests live in a top-level `test/` directory that mirrors `src/`**,
  rather than colocated `*.spec.ts` files. Since this package publishes
  `dist/` built straight from `src/`, keeping test files out of `src/`
  means there's nothing to exclude from the build and no risk of a spec
  file ever ending up in the published package.

## Usage

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoCursorPaginationService, CursorPaginationArgs } from '@mykks32/pagination';
import { User } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly paginationService: MongoCursorPaginationService,
  ) {}

  findUsers(args: CursorPaginationArgs) {
    return this.paginationService.paginate(this.userModel, {
      args,
      sort: [{ field: 'createdAt', direction: 'DESC' }],
      filter: { deletedAt: null },
    });
  }
}
```

Register the service once, wherever it's consumed:

```ts
@Module({
  providers: [MongoCursorPaginationService, UsersService],
})
export class UsersModule {}
```

Calling `findUsers({ first: 20 })` returns:

```ts
{
  edges: [{ node: User, cursor: 'opaque-string' }, ...],
  pageInfo: {
    hasNextPage: boolean,
    hasPreviousPage: boolean,
    startCursor: string | null,
    endCursor: string | null,
  },
}
```

Page forward with `{ first: 20, after: pageInfo.endCursor }`, or backward
with `{ last: 20, before: pageInfo.startCursor }`. Pass
`includeTotalCount: true` to also get a `totalCount` (this issues an extra
`countDocuments`, so it's opt-in).

`sort` accepts multiple fields (`[{ field: 'createdAt', direction: 'DESC' }, { field: 'name', direction: 'ASC' }]`);
`_id` is appended automatically as a final tiebreaker if you don't include
it, which is what guarantees no row is ever skipped or repeated across
pages. **Make sure a compound index exists covering your sort fields (plus
`_id`)** — the seek filter is only as fast as the index it can use.

## API reference

| Export | Kind | Purpose |
| --- | --- | --- |
| `paginate<T>(model, options)` | function | Core cursor pagination, framework-agnostic |
| `MongoCursorPaginationService` | `@Injectable` class | Nest DI wrapper around `paginate` |
| `buildSeekFilter(sort, cursorValues, direction)` | function | Pure keyset `$or` filter builder |
| `encodeCursor` / `decodeCursor` | functions | Opaque cursor (de)serialization |
| `normalizeSortFields` / `toMongoSortObject` / `invertSort` | functions | Sort-field helpers |
| `InvalidCursorException` / `InvalidPaginationArgsException` | `BadRequestException` subclasses | Thrown on malformed cursors or conflicting args |
| `CursorPaginationArgs`, `SortField`, `PageInfo`, `Edge<T>`, `PaginatedResult<T>`, `MongoCursorPaginationOptions<T>` | types | Public contracts |
| `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, `CURSOR_VERSION`, `ID_FIELD` | constants | Tunable defaults |

## Build output

Published as a dual CJS/ESM package via `tsup`:

- `dist/index.js` (CJS) + `dist/index.mjs` (ESM), both built from the same `src/index.ts` entry
- `dist/index.d.ts` — type declarations
- `exports` map in `package.json` so bundlers/Node resolve the right format automatically

`@nestjs/common` and `mongoose` are marked `external` in `tsup.config.ts` — they're peer dependencies and must never be bundled into the published output.

## Development

From the monorepo root (`pnpm install` once, workspace-wide), or scoped to this package:

```bash
pnpm --filter @mykks32/pagination test        # jest, test/**/*.spec.ts
pnpm --filter @mykks32/pagination test:cov    # jest with coverage
pnpm --filter @mykks32/pagination lint        # eslint (flat config, typescript-eslint)
pnpm --filter @mykks32/pagination lint:fix
pnpm --filter @mykks32/pagination format      # prettier --write
pnpm --filter @mykks32/pagination format:check
pnpm --filter @mykks32/pagination build       # tsup -> dist/
```

Linting and formatting are intentionally separate: ESLint catches
correctness/style issues via `typescript-eslint`, and `eslint-config-prettier`
disables any ESLint stylistic rule that would conflict with Prettier, which
owns all formatting.
