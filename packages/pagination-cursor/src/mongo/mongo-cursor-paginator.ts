import type { FilterQuery, Model } from 'mongoose';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination.constants';
import { InvalidPaginationArgsException } from '../errors/pagination.errors';
import type { CursorPage, CursorPaginationArgs, PageInfo } from '../interfaces/pagination.interface';
import type { MongoCursorPaginationOptions } from '../interfaces/mongo-cursor-pagination-options.interface';
import { decodeCursor, encodeCursor } from '../utils/cursor.util';
import { invertSort, normalizeSortFields, toMongoSortObject } from '../utils/mongo-sort.util';
import { buildSeekFilter, type SeekDirection } from './mongo-seek-filter.builder';

interface ParsedArgs {
  readonly limit: number;
  readonly direction: SeekDirection;
  readonly cursor?: string;
}

/**
 * Cursor-paginates a Mongoose query using the keyset ("seek") method,
 * returning a flat `rows` array (no edges/node wrapping — this package's
 * whole point is a REST-flavored envelope, not the Relay connection shape
 * `@mykks32/pagination-relay` uses).
 *
 * Framework-agnostic by design: it only depends on `mongoose`, so it can be
 * unit tested without a Nest application context and reused outside of
 * Nest entirely. {@link MongoCursorPaginationService} is the thin,
 * DI-friendly wrapper around this function for use inside Nest providers.
 */
export async function paginate<T>(model: Model<T>, options: MongoCursorPaginationOptions<T>): Promise<CursorPage<T>> {
  const { filter = {}, projection, queryOptions, includeTotalCount = false } = options;
  // _id is appended as a tiebreaker (if missing) so the keyset stays unique
  // and gap-free even when the leading sort field(s) have duplicate values.
  const sort = normalizeSortFields(options.sort);
  const { limit, direction, cursor } = parseArgs(options.args);

  // No cursor means "first page" — nothing to seek past yet.
  const seekFilter = cursor ? buildSeekFilter<T>(sort, decodeCursor(cursor).values, direction) : undefined;
  // Paging backward queries in reverse sort order (closest-to-cursor first)
  // so `.limit()` grabs the right set of rows; re-reversed back below.
  const effectiveSort = direction === 'before' ? invertSort(sort) : sort;
  const effectiveFilter: FilterQuery<T> = seekFilter ? ({ $and: [filter, seekFilter] } as FilterQuery<T>) : filter;

  // Fetch one row beyond the page size — its presence (or absence) reveals
  // whether there's a next/previous page without issuing a second query.
  const docs = await model
    .find(effectiveFilter, projection, queryOptions)
    .sort(toMongoSortObject(effectiveSort))
    .limit(limit + 1)
    .exec();

  const hasExtra = docs.length > limit;
  const pageDocs = hasExtra ? docs.slice(0, limit) : docs;
  // Undo the reverse-order query above so rows always come back in the
  // caller's requested sort order, regardless of paging direction.
  const rows = direction === 'before' ? pageDocs.reverse() : pageDocs;

  const pageInfo = buildPageInfo(rows, sort, direction, options.args, hasExtra);
  // Opt-in only: countDocuments is an extra scan/index count on top of the
  // page query itself.
  const totalCount = includeTotalCount ? await model.countDocuments(filter).exec() : undefined;

  return {
    rows,
    pageInfo,
    ...(totalCount !== undefined ? { totalCount } : {}),
  };
}

/**
 * Validates the caller's args and normalizes them into a single
 * limit/direction/cursor triple the rest of `paginate()` can work with.
 */
function parseArgs(args: CursorPaginationArgs): ParsedArgs {
  const { first, after, last, before } = args;

  // Forward (first/after) and backward (last/before) arguments are mutually
  // exclusive — mixing them would make "which direction, how many" ambiguous.
  if (first !== undefined && last !== undefined) {
    throw new InvalidPaginationArgsException('Provide either "first" or "last", not both.');
  }
  if (after !== undefined && before !== undefined) {
    throw new InvalidPaginationArgsException('Provide either "after" or "before", not both.');
  }
  if (last !== undefined && after !== undefined) {
    throw new InvalidPaginationArgsException('"last" cannot be combined with "after".');
  }
  if (first !== undefined && before !== undefined) {
    throw new InvalidPaginationArgsException('"first" cannot be combined with "before".');
  }

  const isBackward = last !== undefined || before !== undefined;

  return {
    limit: clampLimit(isBackward ? last : first),
    direction: isBackward ? 'before' : 'after',
    cursor: isBackward ? before : after,
  };
}

/** Applies the default page size and caps the requested limit at `MAX_PAGE_SIZE`, rejecting non-positive-integer input. */
function clampLimit(rawLimit: number | undefined): number {
  const limit = rawLimit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new InvalidPaginationArgsException('"first"/"last" must be a positive integer.');
  }
  return Math.min(limit, MAX_PAGE_SIZE);
}

/** Reads dotted paths off both hydrated Mongoose documents and `.lean()` plain objects. */
function readField(doc: unknown, field: string): unknown {
  // Hydrated documents expose `.get(path)`, which understands dotted paths
  // and virtuals; lean plain objects don't, so fall back to a manual walk.
  if (doc !== null && typeof doc === 'object' && typeof (doc as { get?: unknown }).get === 'function') {
    return (doc as { get: (path: string) => unknown }).get(field);
  }
  return field.split('.').reduce<unknown>((value, key) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[key];
  }, doc);
}

/**
 * Derives `PageInfo` from the fetched page.
 *
 * `hasNextPage`/`hasPreviousPage` can't both be inferred from `hasExtra`:
 * the "extra row" check only tells us about the side we just queried
 * *toward*. The opposite side is inferred from whether a cursor was given
 * for it at all (e.g. paging forward with `after` set implies a previous
 * page exists, since we seeked past it to get here).
 *
 * `startCursor`/`endCursor` are derived from the first/last row's own
 * sort-field values — there's no per-row `edge.cursor` to read since this
 * paginator's output is a flat `rows` array, not Relay edges.
 */
function buildPageInfo<T>(
  rows: T[],
  sort: { field: string }[],
  direction: SeekDirection,
  args: CursorPaginationArgs,
  hasExtra: boolean,
): PageInfo {
  const cursorFor = (doc: T): string => encodeCursor(sort.map((sortField) => readField(doc, sortField.field)));

  return {
    hasNextPage: direction === 'after' ? hasExtra : Boolean(args.before),
    hasPreviousPage: direction === 'before' ? hasExtra : Boolean(args.after),
    startCursor: rows.length > 0 ? cursorFor(rows[0]) : null,
    endCursor: rows.length > 0 ? cursorFor(rows[rows.length - 1]) : null,
  };
}
