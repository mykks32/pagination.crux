/**
 * Public error type thrown by the offset paginator. Extends Nest's
 * `BadRequestException` so it translates to an HTTP 400 automatically when
 * thrown inside a Nest request context. Carries the offending input as a
 * `readonly` property (not just baked into `message`), so a consumer's own
 * error handling can read structured detail without parsing message strings.
 */
import { BadRequestException } from '@nestjs/common';

/** Thrown when `page`/`limit` are non-positive-integer, or `limit` request exceeds what's allowed (before clamping is applied). */
export class InvalidOffsetPaginationArgsException extends BadRequestException {
  readonly received?: unknown;

  /** @param received The raw, un-clamped `page`/`limit` value that failed validation. */
  constructor(message: string, received?: unknown) {
    super(message);
    this.name = 'InvalidOffsetPaginationArgsException';
    this.received = received;
  }
}
