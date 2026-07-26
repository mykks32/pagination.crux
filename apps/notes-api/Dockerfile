# Build context is the repo root (see docker-publish.yml / `docker build -f apps/notes-api/Dockerfile .`)
# since notes-api depends on three sibling workspace packages: pagination-relay,
# pagination-cursor (which itself depends on pagination-relay), and pagination-offset.

FROM node:20-alpine AS base
RUN corepack enable

# --- deps: install with only manifests copied in, so this layer is cached
# across builds unless a package.json or the lockfile actually changes.
FROM base AS deps
WORKDIR /workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/pagination-relay/package.json packages/pagination-relay/package.json
COPY packages/pagination-cursor/package.json packages/pagination-cursor/package.json
COPY packages/pagination-offset/package.json packages/pagination-offset/package.json
COPY apps/notes-api/package.json apps/notes-api/package.json
RUN pnpm install --frozen-lockfile

# --- build: bring in the real source, compile the libraries then the app.
FROM deps AS build
COPY packages/pagination-relay packages/pagination-relay
COPY packages/pagination-cursor packages/pagination-cursor
COPY packages/pagination-offset packages/pagination-offset
COPY apps/notes-api apps/notes-api

# pagination-relay must build before pagination-cursor — cursor imports its
# built dist/ (types + JS) at compile time. pagination-offset has no such
# dependency but is harmless to build in any order.
RUN pnpm --filter @mykks32/pagination-relay run build
RUN pnpm --filter @mykks32/pagination-cursor run build
RUN pnpm --filter @mykks32/pagination-offset run build
RUN pnpm --filter notes-api run build

# `pnpm deploy` produces a self-contained, production-only copy of
# notes-api: its own `files` (dist/) plus a pruned node_modules where each
# @mykks32/pagination-* workspace dependency is materialized as real files
# (each package's own `files`: dist/ + LICENSE) instead of a symlink into
# the monorepo.
RUN pnpm --filter notes-api deploy --prod /app/deploy

# --- runtime: nothing but the deployed output and a production node_modules.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy .
EXPOSE 3000
CMD ["node", "dist/main.js"]
