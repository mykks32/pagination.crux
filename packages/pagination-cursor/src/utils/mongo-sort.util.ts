/**
 * Compound-sort mechanics for the Mongo cursor paginator: normalizing
 * caller-supplied sort definitions, converting them to Mongoose's `.sort()`
 * shape, and inverting them for backward (`before`/`last`) pagination. Not
 * to be confused with `sort-resolution.util.ts`, which resolves a client's
 * `sort`/`order` query params against a field whitelist — this file only
 * deals with an already-resolved `SortField[]`.
 */
import { ID_FIELD } from '../constants/pagination.constants';
import type { SortDirection, SortField } from '../interfaces/pagination.interface';

/**
 * Ensures `_id` is always present as the final sort key. Without a unique
 * tiebreaker, ties on the leading sort field(s) can cause rows to be
 * skipped or repeated across pages.
 */
export function normalizeSortFields(sort: SortField[] | undefined): SortField[] {
  // No caller-supplied sort at all falls back to sorting by _id alone.
  const fields: SortField[] = sort && sort.length > 0 ? sort : [{ field: ID_FIELD, direction: 'ASC' }];
  const hasIdField = fields.some((sortField) => sortField.field === ID_FIELD);
  // Append _id as a tiebreaker, inheriting the primary field's direction so
  // the compound index (sort fields + _id) stays usable.
  return hasIdField ? fields : [...fields, { field: ID_FIELD, direction: fields[0].direction }];
}

/** Converts normalized {@link SortField}s into the `{ field: 1 | -1 }` shape Mongoose's `.sort()` expects. */
export function toMongoSortObject(sort: SortField[]): Record<string, 1 | -1> {
  return sort.reduce<Record<string, 1 | -1>>((acc, { field, direction }) => {
    acc[field] = direction === 'ASC' ? 1 : -1;
    return acc;
  }, {});
}

/**
 * Flips every field's direction. Paging backward (`before`/`last`) is
 * implemented by querying with the sort order reversed and a `$lt`/`$gt`
 * seek filter, then re-reversing the resulting page — see `paginate()` in
 * `mongo-cursor-paginator.ts`.
 */
export function invertSort(sort: SortField[]): SortField[] {
  return sort.map(({ field, direction }) => ({ field, direction: invertDirection(direction) }));
}

/** Flips a single sort direction: `ASC` <-> `DESC`. */
function invertDirection(direction: SortDirection): SortDirection {
  return direction === 'ASC' ? 'DESC' : 'ASC';
}
