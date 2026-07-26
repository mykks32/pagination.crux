/** Public, framework/ODM-agnostic contracts shared by every paginator implementation. */

/** Ascending or descending order for a single sort field. */
export type SortDirection = 'ASC' | 'DESC';

/** One field in a (possibly compound) sort order. */
export interface SortField {
  readonly field: string;
  readonly direction: SortDirection;
}

/**
 * Relay-style connection arguments. `first`/`after` page forward,
 * `last`/`before` page backward. Combining forward and backward args
 * is rejected by the paginator.
 */
export interface CursorPaginationArgs {
  /** Max rows to return when paging forward. */
  readonly first?: number;
  /** Cursor to seek past when paging forward. */
  readonly after?: string;
  /** Max rows to return when paging backward. */
  readonly last?: number;
  /** Cursor to seek past when paging backward. */
  readonly before?: string;
}

/** Relay-style pagination metadata describing the page just returned. */
export interface PageInfo {
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
  /** Cursor of the first row in this page, or `null` if the page is empty. */
  readonly startCursor: string | null;
  /** Cursor of the last row in this page, or `null` if the page is empty. */
  readonly endCursor: string | null;
}

/** A single row plus the cursor that points at it. */
export interface Edge<T> {
  readonly node: T;
  readonly cursor: string;
}

/** Full result of one `paginate()` call: the page of rows, its page info, and an optional total count. */
export interface PaginatedResult<T> {
  readonly edges: Edge<T>[];
  readonly pageInfo: PageInfo;
  /** Only present when `includeTotalCount: true` was passed in the options. */
  readonly totalCount?: number;
}
