/** Tunable defaults for the paginator. */

/** Page size used when the caller omits both `first` and `last`. */
export const DEFAULT_PAGE_SIZE = 20;
/** Hard ceiling `first`/`last` are clamped to, regardless of what the caller requests. */
export const MAX_PAGE_SIZE = 100;
/** Field always appended as the final sort tiebreaker to guarantee a unique, gap-free keyset. */
export const ID_FIELD = '_id';

/**
 * Bumped whenever the cursor payload shape changes in a
 * backwards-incompatible way, so stale cursors fail fast and loud
 * instead of silently mis-paginating.
 */
export const CURSOR_VERSION = 1;
