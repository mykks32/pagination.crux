# pagination monorepo

A pnpm workspace with two projects:

| Path | What it is |
| --- | --- |
| [`packages/pagination`](packages/pagination) | `@mykks32/pagination` — the cursor (keyset) pagination library for NestJS + Mongoose. Publishable to npm. |
| [`apps/notes-api`](apps/notes-api) | A demo NestJS + Mongoose REST API (full Notes CRUD) that consumes `@mykks32/pagination`, showing the library used end-to-end. |

`packages/` holds publishable libraries; `apps/` holds runnable applications that consume them.

## Getting started

```bash
pnpm install                              # installs both workspace projects
pnpm run build                             # builds packages/pagination then apps/notes-api
pnpm run test                              # unit tests, both projects
pnpm --filter notes-api run test:e2e       # notes-api's e2e suite (in-memory MongoDB)
pnpm run lint
pnpm run format:check
```

Each project also has its own README with details specific to it:
- [packages/pagination/README.md](packages/pagination/README.md) — library API, usage, publishing
- [apps/notes-api/README.md](apps/notes-api/README.md) — running the demo app, endpoints, seeding, Docker

## Repo layout

```
.
├── packages/
│   └── pagination/       # @mykks32/pagination — the library
└── apps/
    └── notes-api/        # demo NestJS app consuming the library
```

The two projects are linked via pnpm's workspace protocol
(`"@mykks32/pagination": "workspace:*"` in `apps/notes-api/package.json`), so
`apps/notes-api` always builds against the local library source, not a
published npm version.

## Tooling

Shared across both projects, configured once at the workspace root:
- **TypeScript**, **ESLint** (flat config, `typescript-eslint`), **Prettier**, **Jest**/`ts-jest` — declared as root `devDependencies` so both projects resolve them without duplicating versions.
- `.github/workflows/ci.yml` — lint, format check, test, and build on every push/PR to `main`.
- `.github/workflows/docker-publish.yml` — builds and pushes `apps/notes-api`'s Docker image to GHCR on every `vX.Y.Z` tag push.
