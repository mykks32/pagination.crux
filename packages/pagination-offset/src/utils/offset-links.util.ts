/** Builds the `self`/`first`/`previous`/`next`/`last` links for a paginated REST response. */
import type { OffsetPaginationDto } from '../dto/offset-pagination.dto';
import { OffsetPaginatedLinksSerializer } from '../serializers/offset-paginated-links.serializer';
import type { OffsetPageMetaSerializer } from '../serializers/offset-page-meta.serializer';

/** Everything from the incoming query except `page` — carried over unchanged onto every generated link. */
function sharedParams(query: OffsetPaginationDto): Record<string, unknown> {
  const { page: _page, ...rest } = query;
  return rest;
}

/** Flattens arrays/objects to strings and drops nullish entries, ready for `URLSearchParams`. */
function stringify(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length > 0) out[key] = value.join(',');
      continue;
    }
    out[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}

export function buildOffsetLinks(
  basePath: string,
  query: OffsetPaginationDto,
  meta: OffsetPageMetaSerializer,
): OffsetPaginatedLinksSerializer {
  const shared = sharedParams(query);
  const build = (page: number): string => {
    const qs = new URLSearchParams(stringify({ ...shared, page })).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return Object.assign(new OffsetPaginatedLinksSerializer(), {
    self: build(meta.page),
    // Unlike previous/next, first/last are never null — re-requesting the
    // page you're already on is a harmless no-op, not an invalid request.
    first: build(1),
    previous: meta.hasPreviousPage ? build(meta.page - 1) : null,
    next: meta.hasNextPage ? build(meta.page + 1) : null,
    last: build(Math.max(meta.totalPages, 1)),
  });
}
