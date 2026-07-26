/**
 * Public, framework/ODM-agnostic contracts this package works with —
 * a standalone copy of the same shapes `@mykks32/pagination-relay` defines,
 * not an import from it. This package has no dependency on pagination-relay
 * (see `@mykks32/pagination-offset`'s identical decision, documented in its
 * own `sort.util.ts`): a few lines of duplicated interface declarations are
 * cheaper than a compile-time coupling between two packages meant to be
 * usable independently. Structurally, any object shaped like `PageInfo`
 * (including the one `pagination-relay` actually produces) satisfies it.
 */

/** Ascending or descending order for a single sort field. */
export type SortDirection = 'ASC' | 'DESC';

/** One field in a (possibly compound) sort order. */
export interface SortField {
  readonly field: string;
  readonly direction: SortDirection;
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
