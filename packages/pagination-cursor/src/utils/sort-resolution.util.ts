/** Resolves a client-supplied `sort`/`order` pair against a caller-defined field whitelist. */
import { DEFAULT_SORT_DIRECTION } from '../constants/pagination.constants';
import { InvalidSortFieldException } from '../errors/pagination.errors';
import type { SortDirection, SortField } from '../interfaces/pagination.interface';

/** `order` value as it appears on the wire — mapped to the library's `SortDirection` by {@link resolveSortDirection}. */
export type SortOrder = 'asc' | 'desc';

/** Maps the wire-format `order` ('asc'/'desc') to the library's `SortDirection` ('ASC'/'DESC'), defaulting to `DESC` when omitted. */
export function resolveSortDirection(order: SortOrder | undefined): SortDirection {
  if (order === undefined) return DEFAULT_SORT_DIRECTION;
  return order === 'asc' ? 'ASC' : 'DESC';
}

/**
 * Validates `field` against `allowedFields`, falling back to `defaultField`
 * when omitted. Throws {@link InvalidSortFieldException} for anything not
 * on the whitelist — this is what stops a client from sorting on a field
 * that isn't indexed, or doesn't exist at all.
 */
export function resolveSortField<TField extends string>(
  field: string | undefined,
  allowedFields: readonly TField[],
  defaultField: TField,
): TField {
  const candidate = field ?? defaultField;
  if (!allowedFields.includes(candidate as TField)) {
    throw new InvalidSortFieldException(candidate, allowedFields);
  }
  return candidate as TField;
}

/**
 * Combines {@link resolveSortField} and {@link resolveSortDirection} into
 * the single `SortField` shape every paginator's `sort` option expects.
 */
export function resolveSort<TField extends string>(
  query: { sort?: string; order?: SortOrder },
  allowedFields: readonly TField[],
  defaultField: TField,
): SortField {
  return {
    field: resolveSortField(query.sort, allowedFields, defaultField),
    direction: resolveSortDirection(query.order),
  };
}
