/**
 * Assembles the full `{ data, meta, links }` envelope from a page of
 * already-mapped items plus a `PageInfo`/`totalCount` (structurally
 * compatible with `@mykks32/pagination-relay`'s output, but this package
 * doesn't import from it — see `interfaces/pagination.interface.ts`). This
 * is the one call a controller needs — `buildPaginatedLinks` and the
 * serializer classes exist mainly to make this possible, but are exported
 * individually too for callers who want to assemble the envelope by hand.
 */
import type { CursorPaginationDto } from './dto/cursor-pagination.dto';
import type { PageInfo } from './interfaces/pagination.interface';
import { PaginatedMetaSerializer } from './serializers/paginated-meta.serializer';
import { PaginatedResponseSerializer } from './serializers/paginated-response.serializer';
import { buildPaginatedLinks } from './utils/pagination-links.util';

export function toPaginatedResponse<T>(
  basePath: string,
  query: CursorPaginationDto,
  pageInfo: PageInfo,
  data: T[],
  totalCount?: number,
): PaginatedResponseSerializer<T> {
  const result = new PaginatedResponseSerializer<T>();
  result.data = data;
  result.meta = Object.assign(new PaginatedMetaSerializer(), {
    count: totalCount,
    hasNextPage: pageInfo.hasNextPage,
    hasPreviousPage: pageInfo.hasPreviousPage,
    startCursor: pageInfo.startCursor,
    endCursor: pageInfo.endCursor,
  });
  result.links = buildPaginatedLinks(basePath, query, pageInfo);
  return result;
}
