/** Tunable defaults for query resolution utilities. */

/** Sort direction used when the caller omits `order`. */
export const DEFAULT_SORT_DIRECTION = 'DESC';

/** Page size assumed for `previous`/`next` link generation when neither `first` nor `last` was in the original query — a standalone copy of `@mykks32/pagination-relay`'s constant of the same name (see this file's module doc for why). */
export const DEFAULT_PAGE_SIZE = 20;
