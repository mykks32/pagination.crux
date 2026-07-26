# notes-api

A demo NestJS + Mongoose REST API — full Notes CRUD, built to showcase
[`@mykks32/pagination`](../../packages/pagination)'s cursor pagination end to end.

## Setup

```bash
cp .env.example .env   # then point MONGODB_URI at a reachable MongoDB
pnpm install            # from the monorepo root
pnpm --filter notes-api run start:dev
```

Or run the whole thing (app + MongoDB) via Docker — see [Docker](#docker) below.

## Seeding sample data

```bash
pnpm --filter notes-api run seed
```

Wipes the notes collection and inserts 50 sample notes with `createdAt`
spread over the last 50 days (every 10th one pre-archived), so there's
something real to page through immediately.

## API

Versioned via URI (`/v1/...`), enabled globally in `main.ts`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/v1/notes` | Create a note |
| `GET` | `/v1/notes` | Cursor-paginated list (see below) |
| `GET` | `/v1/notes/:id` | Fetch one note |
| `PATCH` | `/v1/notes/:id` | Partially update a note (including toggling `archived`) |
| `DELETE` | `/v1/notes/:id` | Delete a note |

### Cursor pagination

`GET /v1/notes` accepts the full Relay-style surface from `@mykks32/pagination`:

- Forward: `?first=20`, then `?first=20&after=<pageInfo.endCursor>`
- Backward: `?last=20&before=<pageInfo.startCursor>`
- `sortBy` (`createdAt` | `updatedAt` | `title`, default `createdAt`) and `sortDirection` (`ASC` | `DESC`, default `DESC`)
- `includeArchived` (default `false`) and `includeTotalCount` (default `false`, issues an extra `countDocuments`)

Response shape:

```json
{
  "edges": [{ "node": { "id": "...", "title": "...", "...": "..." }, "cursor": "opaque-string" }],
  "pageInfo": { "hasNextPage": true, "hasPreviousPage": false, "startCursor": "...", "endCursor": "..." }
}
```

### Response serialization

Every response goes through a `NoteResponseDto` (via `class-transformer`
`@Expose`/`@Exclude` + Nest's global `ClassSerializerInterceptor`), so
Mongoose internals (`_id`, `__v`) never leak — clients see a plain `id`.

## Manual API testing (Bruno)

A [Bruno](https://www.usebruno.com/) collection lives in [`bruno/`](bruno) —
open that folder as a collection to get every endpoint pre-built, including
a forward/backward cursor-paging flow that auto-captures cursors and the
created note's id between requests via post-response scripts.

## Testing

```bash
pnpm --filter notes-api run test        # unit tests, colocated *.spec.ts next to their source
pnpm --filter notes-api run test:e2e    # e2e: boots the real app against an in-memory MongoDB
```

## Docker

Build the image (context must be the monorepo root — the app depends on
the sibling `packages/pagination` workspace package):

```bash
docker build -f apps/notes-api/Dockerfile -t notes-api .
```

CI publishes this image to GHCR (`ghcr.io/mykks32/notes-api`) on every
`vX.Y.Z` tag push (see `.github/workflows/docker-publish.yml`).

To run the published image plus a local MongoDB:

```bash
cd apps/notes-api
cp .env.example .env
docker compose up
```
