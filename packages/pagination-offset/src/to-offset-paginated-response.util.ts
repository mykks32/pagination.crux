/** Assembles the full `{ data, meta, links }` envelope from an `OffsetPage`. The one call a controller needs. */
import type { OffsetPaginationDto } from './dto/offset-pagination.dto';
import type { OffsetPage } from './mongo/mongo-offset-paginator';
import { OffsetPaginatedResponseSerializer } from './serializers/offset-paginated-response.serializer';
import { buildOffsetLinks } from './utils/offset-links.util';

export function toOffsetPaginatedResponse<T>(
  basePath: string,
  query: OffsetPaginationDto,
  page: OffsetPage<T>,
): OffsetPaginatedResponseSerializer<T> {
  const result = new OffsetPaginatedResponseSerializer<T>();
  result.data = page.data;
  result.meta = page.meta;
  result.links = buildOffsetLinks(basePath, query, page.meta);
  return result;
}
