import type { FilterQuery } from 'mongoose';
import type { SortField } from '../interfaces/pagination.interface';

export type SeekDirection = 'after' | 'before';

/**
 * Builds a keyset ("seek method") filter for a compound sort.
 *
 * For sort fields [f1, f2, ..., fn] and cursor values [v1, v2, ..., vn],
 * paging forward produces:
 *
 *   { f1: { $gt: v1 } }
 *   OR { f1: v1, f2: { $gt: v2 } }
 *   OR { f1: v1, f2: v2, f3: { $gt: v3 } }
 *   ...
 *
 * (operators flip to `$lt` per-field when that field sorts DESC, and the
 * whole comparison flips when seeking `before` instead of `after`). This
 * is the standard index-friendly alternative to skip/offset pagination —
 * every query hits the compound index on `sort` instead of scanning and
 * discarding `offset` documents.
 */
export function buildSeekFilter<T>(sort: SortField[], cursorValues: unknown[], direction: SeekDirection): FilterQuery<T> {
  if (sort.length !== cursorValues.length) {
    throw new Error(`Sort field count (${sort.length}) does not match cursor value count (${cursorValues.length})`);
  }

  const clauses: FilterQuery<T>[] = [];

  // Build one $or clause per sort field: clause i means "the first i fields
  // are exactly equal to the cursor's values, and field i is strictly past
  // the cursor's value for field i". Together the clauses express
  // lexicographic "greater than the cursor row" across the whole compound
  // sort key.
  for (let i = 0; i < sort.length; i += 1) {
    const equalityConditions: Record<string, unknown> = {};
    for (let j = 0; j < i; j += 1) {
      equalityConditions[sort[j].field] = cursorValues[j];
    }

    const { field, direction: sortDirection } = sort[i];
    // "Past the cursor" means $gt for an ASC field paging forward (or a
    // DESC field paging backward), and $lt otherwise.
    const wantsGreaterThan = (direction === 'after' && sortDirection === 'ASC') || (direction === 'before' && sortDirection === 'DESC');
    const operator = wantsGreaterThan ? '$gt' : '$lt';

    clauses.push({
      ...equalityConditions,
      [field]: { [operator]: cursorValues[i] },
    } as FilterQuery<T>);
  }

  return { $or: clauses } as FilterQuery<T>;
}
