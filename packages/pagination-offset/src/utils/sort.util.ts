/** Sort-field helpers — small and standalone since this package has no dependency on @mykks32/pagination-relay. */
import type { SortField } from '../interfaces/pagination.interface';

const ID_FIELD = '_id';

/**
 * Ensures `_id` is always present as the final sort key. Without a unique
 * tiebreaker, ties on the leading sort field(s) can make skip/limit
 * pagination return a row twice (or skip one) if the underlying data
 * shifts between page requests.
 */
export function normalizeSortFields(sort: SortField[] | undefined): SortField[] {
  const fields: SortField[] = sort && sort.length > 0 ? sort : [{ field: ID_FIELD, direction: 'ASC' }];
  const hasIdField = fields.some((sortField) => sortField.field === ID_FIELD);
  return hasIdField ? fields : [...fields, { field: ID_FIELD, direction: fields[0].direction }];
}

/** Converts normalized `SortField`s into the `{ field: 1 | -1 }` shape Mongoose's `.sort()` expects. */
export function toMongoSortObject(sort: SortField[]): Record<string, 1 | -1> {
  return sort.reduce<Record<string, 1 | -1>>((acc, { field, direction }) => {
    acc[field] = direction === 'ASC' ? 1 : -1;
    return acc;
  }, {});
}
