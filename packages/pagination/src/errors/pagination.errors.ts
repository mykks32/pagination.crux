/**
 * Public error types thrown by the paginator. Both extend Nest's
 * `BadRequestException` so they translate to an HTTP 400 automatically when
 * thrown inside a Nest request context, without any extra exception filter.
 */
import { BadRequestException } from '@nestjs/common';

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
