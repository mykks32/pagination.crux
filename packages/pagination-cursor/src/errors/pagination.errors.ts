/**
 * Public error types thrown by this package's query-handling utilities and
 * Mongo cursor paginator. All extend Nest's `BadRequestException` so they
 * translate to an HTTP 400 automatically when thrown inside a Nest request
 * context. Each also carries the offending input as `readonly` properties
 * (not just baked into `message`), so a consumer's own error handling can
 * read structured detail without parsing message strings.
 */
import { BadRequestException } from '@nestjs/common';

/** Thrown by `resolveSortField()` when the requested `sort` value isn't in the caller's field whitelist. */
export class InvalidSortFieldException extends BadRequestException {
  readonly field: string;
  readonly allowedFields: readonly string[];

  constructor(field: string, allowedFields: readonly string[]) {
    super(`"sort" must be one of: ${allowedFields.join(', ')}. Received "${field}".`);
    this.name = 'InvalidSortFieldException';
    this.field = field;
    this.allowedFields = allowedFields;
  }
}

/** Thrown by `sanitizeFilters()` when `filters` contains a non-whitelisted key or a non-primitive value. */
export class InvalidFilterException extends BadRequestException {
  readonly field?: string;
  readonly allowedFields?: readonly string[];

  /**
   * @param field The offending filter key.
   * @param allowedFields The filter-key whitelist, present only when `field` itself was rejected (absent when `field` was allowed but its value wasn't a primitive).
   */
  constructor(message: string, field?: string, allowedFields?: readonly string[]) {
    super(message);
    this.name = 'InvalidFilterException';
    this.field = field;
    this.allowedFields = allowedFields;
  }
}

/** Thrown when a cursor string fails to decode, fails shape validation, or was minted under a different `CURSOR_VERSION`. */
export class InvalidCursorException extends BadRequestException {
  readonly cursor: string;

  /**
   * @param cursor The raw, still-encoded cursor string that failed to decode (echoed back for debuggability).
   * @param cause The underlying decode error, attached via the standard `Error.cause` chain.
   */
  constructor(cursor: string, cause?: unknown) {
    super(`Invalid pagination cursor: "${cursor}"`);
    this.name = 'InvalidCursorException';
    this.cursor = cursor;
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Thrown when the caller's `first`/`after`/`last`/`before` combination is self-contradictory (e.g. both `first` and `last`). */
export class InvalidPaginationArgsException extends BadRequestException {
  readonly args?: Record<string, unknown>;

  /** @param args The specific arg(s) that violated the rule described by `message` (e.g. `{ first, last }`). */
  constructor(message: string, args?: Record<string, unknown>) {
    super(message);
    this.name = 'InvalidPaginationArgsException';
    this.args = args;
  }
}
