/**
 * Public error types thrown by this package's query-handling utilities.
 * Both extend Nest's `BadRequestException` so they translate to an HTTP
 * 400 automatically when thrown inside a Nest request context.
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
