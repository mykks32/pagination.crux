import type { FilterQuery, ProjectionType, QueryOptions } from 'mongoose';
import type { OffsetPaginationArgs, SortField } from './pagination.interface';

/** Options accepted by `paginate()` / `MongoOffsetPaginationService.paginate()` for a single Mongoose model. */
export interface MongoOffsetPaginationOptions<T> {
  /** Page/limit arguments. */
  readonly args: OffsetPaginationArgs;
  /** Sort order applied to the query, evaluated in priority order. Defaults to `[{ field: '_id', direction: 'ASC' }]`. */
  readonly sort?: SortField[];
  /** Static filter applied to both the page query and the `countDocuments` call. */
  readonly filter?: FilterQuery<T>;
  /** Passed straight through to Mongoose's `.find(filter, projection)`. */
  readonly projection?: ProjectionType<T>;
  /** Passed straight through to Mongoose's `.find(filter, projection, queryOptions)`. */
  readonly queryOptions?: QueryOptions;
}
