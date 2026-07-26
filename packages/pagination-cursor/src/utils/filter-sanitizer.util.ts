/** Whitelists a client-supplied `filters` object down to known fields with primitive-only values. */
import { InvalidFilterException } from '../errors/pagination.errors';

function isPrimitive(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/** A primitive, or an array of primitives — never a nested object, which is how Mongo query operators (`$where`, etc.) sneak in through an ad-hoc filter param. */
function isPlainFilterValue(value: unknown): boolean {
  return isPrimitive(value) || (Array.isArray(value) && value.every(isPrimitive));
}

/**
 * Rejects any key not in `allowedFields` and any value that isn't a
 * primitive (or array of primitives), throwing {@link InvalidFilterException}
 * for the first violation found. Returns a plain object safe to spread into
 * a Mongo `FilterQuery`.
 */
export function sanitizeFilters<TField extends string>(
  filters: Record<string, unknown> | undefined,
  allowedFields: readonly TField[],
): Partial<Record<TField, unknown>> {
  if (!filters) return {};

  const sanitized: Partial<Record<TField, unknown>> = {};
  for (const [field, value] of Object.entries(filters)) {
    if (!(allowedFields as readonly string[]).includes(field)) {
      throw new InvalidFilterException(`"${field}" is not a filterable field. Allowed: ${allowedFields.join(', ')}.`);
    }
    if (!isPlainFilterValue(value)) {
      throw new InvalidFilterException(`Filter value for "${field}" must be a string, number, boolean, or array of those — not an object.`);
    }
    sanitized[field as TField] = value;
  }
  return sanitized;
}
