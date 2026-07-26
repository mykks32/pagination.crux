/**
 * Assembles the full `{ data, meta, links }` envelope from a page of
 * already-mapped items plus the underlying `PageInfo`/`totalCount` from
 * `@mykks32/pagination-relay`. This is the one call a controller needs —
 * `buildPaginatedLinks` and the serializer classes exist mainly to make
 * this possible, but are exported individually too for callers who want
 * to assemble the envelope by hand.
 */
import type { PageInfo } from '@mykks32/pagination-relay';
import type { CursorPaginationDto } from './dto/cursor-pagination.dto';
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
