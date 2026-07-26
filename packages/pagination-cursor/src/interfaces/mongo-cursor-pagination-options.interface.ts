import type { FilterQuery, ProjectionType, QueryOptions } from 'mongoose';
import type { CursorPaginationArgs, SortField } from './pagination.interface';

/** Options accepted by `paginate()` / `MongoCursorPaginationService.paginate()` for a single Mongoose model. */
export interface MongoCursorPaginationOptions<T> {
  /** first/after/last/before arguments. */
  readonly args: CursorPaginationArgs;
  /**
   * Sort order applied to the query, evaluated in priority order.
   * `_id` is appended automatically as a final tiebreaker if not present,
   * which guarantees a stable, gap-free and duplicate-free keyset.
   * Defaults to `[{ field: '_id', direction: 'ASC' }]`.
   */
  readonly sort?: SortField[];
  /** Static filter merged with the cursor's seek filter (e.g. `{ status: 'active' }`). */
  readonly filter?: FilterQuery<T>;
  /** Passed straight through to Mongoose's `.find(filter, projection)`. */
  readonly projection?: ProjectionType<T>;
  /** Passed straight through to Mongoose's `.find(filter, projection, queryOptions)` (e.g. `{ lean: true }`). */
  readonly queryOptions?: QueryOptions;
  /**
   * Runs an extra `countDocuments` against `filter` (ignoring the cursor).
   * Disabled by default because it is an additional collection scan/index count.
   */
  readonly includeTotalCount?: boolean;
}
