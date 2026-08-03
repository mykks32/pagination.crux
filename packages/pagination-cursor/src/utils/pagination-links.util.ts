/** Builds the `self`/`previous`/`next` links for a paginated REST response. */
import { DEFAULT_PAGE_SIZE } from '../constants/pagination.constants';
import type { CursorPaginationDto } from '../dto/cursor-pagination.dto';
import type { PageInfo } from '../interfaces/pagination.interface';
import { PaginatedLinksSerializer } from '../serializers/paginated-links.serializer';

/**
 * Everything from the incoming query except the pagination-direction
 * fields (first/last/after/before) — carried over unchanged onto every
 * generated link so filters/sort/search/fieldset selection survive paging.
 */
function sharedParams(query: CursorPaginationDto): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...query };
  delete rest.first;
  delete rest.last;
  delete rest.after;
  delete rest.before;
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
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
      out[key] = String(value);
      continue;
    }
    out[key] = JSON.stringify(value);
  }
  return out;
}

export function buildPaginatedLinks(basePath: string, query: CursorPaginationDto, pageInfo: PageInfo): PaginatedLinksSerializer {
  const shared = sharedParams(query);
  const pageSize = query.first ?? query.last ?? DEFAULT_PAGE_SIZE;
  const { first, last, after, before } = query;

  const build = (params: Record<string, unknown>): string => {
    const qs = new URLSearchParams(stringify({ ...shared, ...params })).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return Object.assign(new PaginatedLinksSerializer(), {
    self: build({ first, last, after, before }),
    previous: pageInfo.hasPreviousPage ? build({ last: pageSize, before: pageInfo.startCursor }) : null,
    next: pageInfo.hasNextPage ? build({ first: pageSize, after: pageInfo.endCursor }) : null,
  });
}
