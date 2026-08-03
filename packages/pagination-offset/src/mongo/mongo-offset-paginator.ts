import type { Model } from 'mongoose';
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from '../constants/pagination.constants';
import { InvalidOffsetPaginationArgsException } from '../errors/pagination.errors';
import type { OffsetPaginationArgs } from '../interfaces/pagination.interface';
import type { MongoOffsetPaginationOptions } from '../interfaces/mongo-offset-pagination-options.interface';
import { OffsetPageMetaSerializer } from '../serializers/offset-page-meta.serializer';
import { normalizeSortFields, toMongoSortObject } from '../utils/sort.util';

export interface OffsetPage<T> {
  readonly data: T[];
  readonly meta: OffsetPageMetaSerializer;
}

/**
 * Classic page/limit ("offset") pagination over a Mongoose query.
 *
 * Unlike `@mykks32/pagination-relay`'s cursor/seek approach, this always
 * runs a `countDocuments` alongside the page query — offset pagination's
 * whole meta shape (`totalPages`, `hasNextPage`, jump-to-any-page `links`)
 * depends on knowing the total up front, so there's no opt-out the way
 * cursor pagination's `includeTotalCount` is opt-in. The trade-off is the
 * one every offset-paginated API makes: an extra count query per page, and
 * `skip()` cost that grows with page number on large collections. Reach
 * for `@mykks32/pagination-relay`/`-cursor` instead when either of those
 * matters more than being able to jump straight to page 8 of 20.
 */
export async function paginate<T>(model: Model<T>, options: MongoOffsetPaginationOptions<T>): Promise<OffsetPage<T>> {
  const { filter = {}, projection, queryOptions } = options;
  const sort = normalizeSortFields(options.sort);
  const { page, limit } = parseArgs(options.args);
  const skip = (page - 1) * limit;

  // Run together rather than sequentially — the count doesn't depend on
  // the page query's result, so there's no reason to wait for one before
  // starting the other.
  const [data, totalItems] = await Promise.all([
    model.find(filter, projection, queryOptions).sort(toMongoSortObject(sort)).skip(skip).limit(limit).exec(),
    model.countDocuments(filter).exec(),
  ]);

  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);

  return {
    data,
    meta: Object.assign(new OffsetPageMetaSerializer(), {
      page,
      limit,
      count: data.length,
      totalItems,
      totalPages,
      hasPreviousPage: page > 1,
      hasNextPage: page < totalPages,
    }),
  };
}

/** Validates and normalizes the caller's `page`/`limit` args. */
function parseArgs(args: OffsetPaginationArgs): { page: number; limit: number } {
  const page = args.page ?? DEFAULT_PAGE;
  if (!Number.isInteger(page) || page < 1) {
    throw new InvalidOffsetPaginationArgsException('"page" must be a positive integer.', page);
  }

  const rawLimit = args.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    throw new InvalidOffsetPaginationArgsException('"limit" must be a positive integer.', rawLimit);
  }

  return { page, limit: Math.min(rawLimit, MAX_LIMIT) };
}
