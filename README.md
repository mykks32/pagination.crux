# pagination monorepo

A pnpm workspace with three pagination libraries and one demo app that
consumes all of them side by side:

| Path | What it is |
| --- | --- |
| [`packages/pagination-relay`](packages/pagination-relay) | `@mykks32/pagination-relay` — the cursor (keyset) pagination **engine**: Relay Cursor Connections shape (`edges`/`node`/`cursor` + `pageInfo`). Publishable. |
| [`packages/pagination-cursor`](packages/pagination-cursor) | `@mykks32/pagination-cursor` — a flat REST envelope (`{ data, meta, links }`) for cursor pagination, backed by its own Mongo keyset paginator (not a reshape of `pagination-relay`'s). Self-contained: no dependency on `pagination-relay` or `pagination-offset`. Publishable. |
| [`packages/pagination-offset`](packages/pagination-offset) | `@mykks32/pagination-offset` — a self-contained, *different* pagination style: classic page/limit, with its own REST envelope. No dependency on the other two. Publishable. |
| [`apps/notes-api`](apps/notes-api) | A demo NestJS + Mongoose REST API (full Notes CRUD) exposing all three styles side by side, one per API version (`/v1`, `/v2`, `/v3`). |

`packages/` holds publishable libraries; `apps/` holds runnable
applications that consume them. See each package's own README for **why**
it exists and **when** to reach for it over its siblings — the short
version:

- Building GraphQL, or want the Relay connection shape over REST? → `pagination-relay`
- A conventional REST list endpoint, cursor-based (scales to deep pagination, stable under writes)? → `pagination-cursor`
- Need page-number navigation (`?page=3`, "8 of 20", jump to any page)? → `pagination-offset`

## Getting started

```bash
pnpm install                              # installs every workspace project
pnpm run build                             # builds all 3 packages, then notes-api
pnpm run test                              # unit tests, every project
pnpm --filter notes-api run test:e2e       # notes-api's e2e suite (in-memory MongoDB, exercises v1/v2/v3)
pnpm run lint
pnpm run format:check
```

The three `packages/*` are independent of each other and can build in any
order — only `apps/notes-api` depends on (and must build after) all three.
`pnpm -r run build` already respects this (topological, via the workspace
protocol dependency) — see `.github/workflows/publish-package.yml` if
you're scripting a build outside of `pnpm -r`.

Each project also has its own README with details specific to it:
- [packages/pagination-relay/README.md](packages/pagination-relay/README.md)
- [packages/pagination-cursor/README.md](packages/pagination-cursor/README.md)
- [packages/pagination-offset/README.md](packages/pagination-offset/README.md)
- [apps/notes-api/README.md](apps/notes-api/README.md) — running the demo app, all three API versions, seeding, Docker

See also [CONTRIBUTING.md](CONTRIBUTING.md) for one non-obvious gotcha:
a few imports in `apps/notes-api` must stay real (non-type-only) imports
for NestJS DI to work — don't let an automated `lint:fix` "clean" them.

## Repo layout

```
.
├── packages/
│   ├── pagination-relay/    # @mykks32/pagination-relay — cursor pagination engine
│   ├── pagination-cursor/   # @mykks32/pagination-cursor — flat REST envelope, own Mongo cursor engine
│   └── pagination-offset/   # @mykks32/pagination-offset — standalone page/limit pagination
└── apps/
    └── notes-api/           # demo NestJS app: /v1 (relay), /v2 (cursor-REST), /v3 (offset)
```

`apps/notes-api/package.json` links all three via pnpm's workspace
protocol (`"@mykks32/pagination-*": "workspace:*"`), so it always builds
against local source, not a published version. None of the three
`packages/*` link to each other this way — each is workspace-independent.

## Tooling

Shared across every project, configured once at the workspace root:
- **TypeScript**, **ESLint** (flat config, `typescript-eslint`), **Prettier**, **Jest**/`ts-jest` — declared as root `devDependencies` so every project resolves them without duplicating versions.
- `.github/workflows/ci.yml` — lint, format check, test, and build on every push/PR to `main`.
- `.github/workflows/docker-publish.yml` — builds and pushes `apps/notes-api`'s Docker image to GHCR on every `vX.Y.Z` tag push.
- `.github/workflows/publish-package.yml` — builds and publishes all three `@mykks32/pagination-*` packages to GitHub Packages on every `vX.Y.Z` tag push.
