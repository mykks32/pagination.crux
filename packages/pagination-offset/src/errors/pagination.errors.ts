/**
 * Public error type thrown by the offset paginator. Extends Nest's
 * `BadRequestException` so it translates to an HTTP 400 automatically when
 * thrown inside a Nest request context.
 */
import { BadRequestException } from '@nestjs/common';

/** Thrown when `page`/`limit` are non-positive-integer, or `limit` request exceeds what's allowed (before clamping is applied). */
export class InvalidOffsetPaginationArgsException extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidOffsetPaginationArgsException';
  }
}
