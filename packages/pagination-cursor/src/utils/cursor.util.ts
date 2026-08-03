/**
 * Opaque cursor (de)serialization.
 *
 * A cursor is just the base64url-encoded JSON of the sort-field values for
 * one row (e.g. `[createdAt, _id]`), plus a version tag. Clients treat it as
 * an opaque token; the paginator decodes it back into the values needed to
 * build the next seek filter.
 */
import { CURSOR_VERSION } from '../constants/pagination.constants';
import { InvalidCursorException } from '../errors/pagination.errors';

/** Shape of the JSON payload embedded inside every cursor string. */
export interface CursorPayload {
  /** Cursor format version, checked against {@link CURSOR_VERSION} on decode. */
  readonly v: number;
  /** Sort-field values for the row this cursor points at, in sort order. */
  readonly values: unknown[];
}

/** Wire representation used to round-trip a `Date` through `JSON.stringify`/`parse`. */
interface SerializedDate {
  readonly __type: 'Date';
  readonly iso: string;
}

/**
 * Type guard for {@link SerializedDate}. Used by {@link decodeCursor}'s
 * `JSON.parse` reviver to know when to rehydrate a plain object back into a
 * real `Date` instance.
 */
function isSerializedDate(value: unknown): value is SerializedDate {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).__type === 'Date' &&
    typeof (value as Record<string, unknown>).iso === 'string'
  );
}

/**
 * Encodes ordered sort-field values (in the same order as the paginator's
 * sort definition) into an opaque, URL-safe cursor.
 *
 * Dates are wrapped *before* `JSON.stringify` runs, not via its replacer:
 * `Date.prototype.toJSON` converts a Date to a plain ISO string before the
 * replacer ever sees it, so `instanceof Date` inside a replacer never
 * matches.
 */
export function encodeCursor(values: unknown[]): string {
  // Wrap Dates in a tagged shape *before* stringifying, since by the time a
  // JSON.stringify replacer sees a Date it has already been coerced to a
  // plain ISO string (Date.prototype.toJSON runs first).
  const serializedValues = values.map((value): unknown =>
    value instanceof Date ? ({ __type: 'Date', iso: value.toISOString() } satisfies SerializedDate) : value,
  );
  const payload: CursorPayload = { v: CURSOR_VERSION, values: serializedValues };
  const json = JSON.stringify(payload);
  // base64url (not plain base64) so the cursor is safe to drop straight into
  // a query string without additional escaping.
  return Buffer.from(json, 'utf8').toString('base64url');
}

/**
 * Decodes and shape-validates a cursor produced by {@link encodeCursor}.
 * Throws {@link InvalidCursorException} for malformed, tampered, or
 * wrong-version cursors so bad client input never reaches the query layer.
 */
export function decodeCursor(cursor: string): CursorPayload {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    // The reviver rehydrates any tagged Date objects back into real Dates
    // as JSON.parse walks the tree, mirroring the encode step above.
    const payload = JSON.parse(json, (_key, value: unknown) => (isSerializedDate(value) ? new Date(value.iso) : value)) as unknown;

    // Shape-check before trusting the payload — this is the boundary where
    // arbitrary client-supplied strings enter the system.
    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof (payload as CursorPayload).v !== 'number' ||
      !Array.isArray((payload as CursorPayload).values)
    ) {
      throw new Error('Malformed cursor payload');
    }

    // Reject cursors minted under a previous CURSOR_VERSION rather than
    // silently mis-paginating against a payload shape we no longer expect.
    if ((payload as CursorPayload).v !== CURSOR_VERSION) {
      throw new Error(`Unsupported cursor version: ${(payload as CursorPayload).v}`);
    }

    return payload as CursorPayload;
  } catch (error) {
    // Any failure above (bad base64, invalid JSON, shape mismatch, version
    // mismatch) collapses to the same public exception — callers shouldn't
    // be able to distinguish "tampered" from "malformed" from "stale".
    throw new InvalidCursorException(cursor, error);
  }
}
