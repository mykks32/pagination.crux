/**
 * Public error types thrown by this package's query-handling utilities and
 * Mongo cursor paginator. All extend Nest's `BadRequestException` so they
 * translate to an HTTP 400 automatically when thrown inside a Nest request
 * context.
 */
import { BadRequestException } from '@nestjs/common';

/** Thrown by `resolveSortField()` when the requested `sort` value isn't in the caller's field whitelist. */
export class InvalidSortFieldException extends BadRequestException {
  constructor(field: string, allowedFields: readonly string[]) {
    super(`"sort" must be one of: ${allowedFields.join(', ')}. Received "${field}".`);
    this.name = 'InvalidSortFieldException';
  }
}

/** Thrown by `sanitizeFilters()` when `filters` contains a non-whitelisted key or a non-primitive value. */
export class InvalidFilterException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFilterException';
  }
}

/** Thrown when a cursor string fails to decode, fails shape validation, or was minted under a different `CURSOR_VERSION`. */
export class InvalidCursorException extends BadRequestException {
  /**
   * @param cursor The raw, still-encoded cursor string that failed to decode (echoed back for debuggability).
   * @param cause The underlying decode error, attached via the standard `Error.cause` chain.
   */
  constructor(cursor: string, cause?: unknown) {
    super(`Invalid pagination cursor: "${cursor}"`);
    this.name = 'InvalidCursorException';
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

/** Thrown when the caller's `first`/`after`/`last`/`before` combination is self-contradictory (e.g. both `first` and `last`). */
export class InvalidPaginationArgsException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPaginationArgsException';
  }
}
