# notes-api

A demo NestJS + Mongoose REST API — full Notes CRUD, built to showcase all
three pagination packages in this monorepo side by side, each under its own
API version:

| Version | Style | Package | Response shape |
| --- | --- | --- | --- |
| `/v1/notes` | Relay Cursor Connections | [`@mykks32/pagination-relay`](../../packages/pagination-relay) | `{ edges, pageInfo }` |
| `/v2/notes` | Cursor, flat REST envelope | [`@mykks32/pagination-cursor`](../../packages/pagination-cursor) | `{ data, meta, links }` |
| `/v3/notes` | Offset (page/limit) | [`@mykks32/pagination-offset`](../../packages/pagination-offset) | `{ data, meta, links }` |

Create/read-one/update/delete are identical across all three versions
(`@Version(['1', '2', '3'])` on those handlers in `NotesController`) — only
the *list* endpoint's pagination style differs per version. See each
package's own README for why you'd pick it.

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

Versioned via URI (`/v1/...`, `/v2/...`, `/v3/...`), enabled globally in `main.ts`.

| Method | Path | Versions | Description |
| --- | --- | --- | --- |
| `POST` | `/notes` | 1, 2, 3 | Create a note |
| `GET` | `/notes` | 1 | Relay-style cursor-paginated list |
| `GET` | `/notes` | 2 | Flat-REST cursor-paginated list |
| `GET` | `/notes` | 3 | Offset (page/limit) paginated list |
| `GET` | `/notes/:id` | 1, 2, 3 | Fetch one note |
| `PATCH` | `/notes/:id` | 1, 2, 3 | Partially update a note (including toggling `archived`) |
| `DELETE` | `/notes/:id` | 1, 2, 3 | Delete a note |

### v1 — Relay-style cursor pagination

`GET /v1/notes` returns `@mykks32/pagination-relay`'s native shape,
unreshaped:

```json
{
  "edges": [{ "node": { "id": "...", "title": "..." }, "cursor": "opaque-string" }],
  "pageInfo": { "hasNextPage": true, "hasPreviousPage": false, "startCursor": "...", "endCursor": "..." }
}
```

Forward: `?first=20` then `?first=20&after=<pageInfo.endCursor>`. Backward:
`?last=20&before=<pageInfo.startCursor>`.

### v2 — flat REST cursor pagination

`GET /v2/notes` runs the *same* cursor pagination as v1 (same query params,
same underlying seek filter), but reshaped by `@mykks32/pagination-cursor`
into a flat envelope — no `edges`/`node` wrapping:

```json
{
  "data": [{ "id": "...", "title": "...", "...": "..." }],
  "meta": {
    "count": 45,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "opaque-string",
    "endCursor": "opaque-string"
  },
  "links": {
    "self": "/v2/notes?first=10",
    "previous": null,
    "next": "/v2/notes?first=10&after=opaque-string"
  }
}
```

Query params (`ListNotesQueryDto` extends `@mykks32/pagination-cursor`'s
`CursorPaginationDto` — used by both v1 and v2, since only the response
shape differs between them):

| Param | Description |
| --- | --- |
| `first` / `after` | Forward paging: page size + cursor from `pageInfo.endCursor` (v1) / `meta.endCursor` (v2) |
| `last` / `before` | Backward paging: page size + cursor from `pageInfo.startCursor` (v1) / `meta.startCursor` (v2) |
| `search` | Free-text search over title/content, backed by a MongoDB text index |
| `sort` | `createdAt` \| `updatedAt` \| `title` (default `createdAt`) |
| `order` | `asc` \| `desc` (default `desc`) |
| `include` | Comma-separated field allowlist — each item only has these fields (plus `id`). v2 only; v1 doesn't apply field selection since it returns full `Edge` objects |
| `exclude` | Comma-separated field denylist — ignored if `include` is also given. v2 only |
| `filters` | JSON-encoded ad-hoc equality filters, e.g. `?filters={"tags":"work"}`. Whitelisted server-side (`NOTE_FILTERABLE_FIELDS` in `list-notes-query.dto.ts`) — unknown keys or non-primitive values are rejected with 400, since passing this straight through would be a NoSQL injection vector |
| `includeArchived` | Default `false` |
| `includeTotalCount` | Default `false` — populates `totalCount` (v1) / `meta.count` (v2); opt-in since it's an extra `countDocuments` |

### v3 — offset (page/limit) pagination

`GET /v3/notes` uses `@mykks32/pagination-offset` — a different pagination
*style*, not a reshaping of v1/v2's cursor logic. `page`/`limit` instead of
`first`/`after`; the response always includes a full item count and
jump-to-any-page links:

```json
{
  "data": [{ "id": "...", "title": "..." }],
  "meta": {
    "page": 2, "limit": 20, "count": 20,
    "totalItems": 156, "totalPages": 8,
    "hasPreviousPage": true, "hasNextPage": true
  },
  "links": {
    "self": "/v3/notes?limit=20&page=2",
    "first": "/v3/notes?limit=20&page=1",
    "previous": "/v3/notes?limit=20&page=1",
    "next": "/v3/notes?limit=20&page=3",
    "last": "/v3/notes?limit=20&page=8"
  }
}
```

`ListNotesOffsetQueryDto` extends `@mykks32/pagination-offset`'s
`OffsetPaginationDto` with the same `search`/`sort`/`order`/`include`/
`exclude`/`filters`/`includeArchived` support as v1/v2 (there's no
`includeTotalCount` toggle here — offset pagination always computes the
total, since `totalPages`/`links.last` depend on it).

### Response serialization

Every response goes through `NoteSerializer` (in `src/notes/serializers/`)
via the generic `response()` helper (`src/common/serializers/`), built on
`class-transformer`'s `@Expose`/`@Exclude` + Nest's global
`ClassSerializerInterceptor` — so Mongoose internals (`_id`, `__v`) never
leak; clients see a plain `id`.

## Project structure

```
src/
├── main.ts / app.module.ts
├── config/                    # env var loading
├── common/
│   └── serializers/
│       └── response.serializer.ts   # generic plainToInstance() wrapper used by every response class
└── notes/
    ├── notes.module.ts
    ├── controllers/
    │   └── notes.controller.ts       # v1/v2/v3 findAll variants via @Version(); shared CRUD
    ├── services/
    │   └── notes.service.ts          # shared sort/filter logic; delegates to both pagination services
    ├── serializers/
    │   └── note.serializer.ts        # output-only — see "why serializers/ not dto/" below
    ├── dto/                           # input only — validated request bodies/query params
    │   ├── create-note.dto.ts
    │   ├── update-note.dto.ts
    │   ├── list-notes-query.dto.ts        # extends @mykks32/pagination-cursor's CursorPaginationDto
    │   └── list-notes-offset-query.dto.ts # extends @mykks32/pagination-offset's OffsetPaginationDto
    └── schemas/
        └── note.schema.ts
```

**`dto/` vs `serializers/`:** `dto/` holds only validated *input* shapes
(`class-validator`-decorated, used with `@Body()`/`@Query()`).
`serializers/` holds *output* shapes (`class-transformer`-decorated,
built via `response()` and serialized by the global
`ClassSerializerInterceptor`). Mixing the two in one folder made it easy to
lose track of which classes need which decorator library.

**`controllers/`/`services/` as folders, not flat files:** with three
listing styles living in one controller/service pair, keeping each concern
in its own directory (alongside `dto/`/`serializers/`/`schemas/`) scales
better than Nest CLI's flat-file-per-feature default once a feature module
gets this much surface area.

## Manual API testing (Bruno)

A [Bruno](https://www.usebruno.com/) collection lives in [`bruno/`](bruno) —
open that folder as a collection to get every endpoint pre-built:
CRUD (v1), a forward/backward v1 cursor-paging flow with auto-captured
cursors, a v2 cursor-REST list request, and a v3 offset list request. The
`Local` environment defines `baseUrl`/`baseUrlV2`/`baseUrlV3` for the three
API versions.

## Testing

```bash
pnpm --filter notes-api run test        # unit tests, colocated *.spec.ts next to their source
pnpm --filter notes-api run test:e2e    # e2e: boots the real app against an in-memory MongoDB, exercises v1/v2/v3
```

## Docker

Build the image (context must be the monorepo root — the app depends on
three sibling `packages/pagination-*` workspace packages):

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

This also starts [mongo-express](https://github.com/mongo-express/mongo-express)
at http://localhost:8081 — a web UI for browsing the notes collection
(dev convenience only, not part of the app).
