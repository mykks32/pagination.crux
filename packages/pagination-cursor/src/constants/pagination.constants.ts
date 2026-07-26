/** Tunable defaults for query resolution utilities and the Mongo cursor paginator. */

/** Sort direction used when the caller omits `order`. */
export const DEFAULT_SORT_DIRECTION = 'DESC';

/** Page size used when the caller omits both `first` and `last`, and assumed for `previous`/`next` link generation when neither was in the original query. */
export const DEFAULT_PAGE_SIZE = 20;

/** Hard ceiling `first`/`last` are clamped to, regardless of what the caller requests. */
export const MAX_PAGE_SIZE = 100;

/** Field always appended as the final sort tiebreaker to guarantee a unique, gap-free keyset. */
export const ID_FIELD = '_id';

/**
 * Bumped whenever the cursor payload shape changes in a
 * backwards-incompatible way, so stale cursors fail fast and loud instead
 * of silently mis-paginating.
 */
export const CURSOR_VERSION = 1;
