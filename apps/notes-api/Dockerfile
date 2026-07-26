# Build context is the repo root (see docker-publish.yml / `docker build -f apps/notes-api/Dockerfile .`)
# since notes-api depends on the sibling `@mykks32/pagination` workspace package.

FROM node:20-alpine AS base
RUN corepack enable

# --- deps: install with only manifests copied in, so this layer is cached
# across builds unless a package.json or the lockfile actually changes.
FROM base AS deps
WORKDIR /workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/pagination/package.json packages/pagination/package.json
COPY apps/notes-api/package.json apps/notes-api/package.json
RUN pnpm install --frozen-lockfile

# --- build: bring in the real source, compile the library then the app.
FROM deps AS build
COPY packages/pagination packages/pagination
COPY apps/notes-api apps/notes-api
RUN pnpm --filter @mykks32/pagination run build
RUN pnpm --filter notes-api run build

# `pnpm deploy` produces a self-contained, production-only copy of
# notes-api: its own `files` (dist/) plus a pruned node_modules where the
# @mykks32/pagination workspace dependency is materialized as real files
# (its own `files`: dist/ + LICENSE) instead of a symlink into the monorepo.
RUN pnpm --filter notes-api deploy --prod /app/deploy

# --- runtime: nothing but the deployed output and a production node_modules.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/deploy .
EXPOSE 3000
CMD ["node", "dist/main.js"]
