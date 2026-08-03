import {
  InvalidCursorException,
  InvalidFilterException,
  InvalidPaginationArgsException,
  InvalidSortFieldException,
} from '../../src/errors/pagination.errors';

describe('pagination.errors', () => {
  it('InvalidSortFieldException reports the allowed fields', () => {
    const error = new InvalidSortFieldException('secret', ['title', 'createdAt']);
    expect(error.name).toBe('InvalidSortFieldException');
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('title, createdAt');
    expect(error.message).toContain('secret');
    expect(error.field).toBe('secret');
    expect(error.allowedFields).toEqual(['title', 'createdAt']);
  });

  it('InvalidFilterException carries the given message and, when rejecting the field itself, the whitelist', () => {
    const error = new InvalidFilterException('"secret" is not a filterable field.', 'secret', ['title', 'createdAt']);
    expect(error.name).toBe('InvalidFilterException');
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe('"secret" is not a filterable field.');
    expect(error.field).toBe('secret');
    expect(error.allowedFields).toEqual(['title', 'createdAt']);
  });

  it('InvalidFilterException omits allowedFields when only the value (not the field) was rejected', () => {
    const error = new InvalidFilterException('Filter value for "title" must be a primitive.', 'title');
    expect(error.field).toBe('title');
    expect(error.allowedFields).toBeUndefined();
  });

  it('InvalidCursorException reports the offending cursor', () => {
    const cause = new Error('bad base64');
    const error = new InvalidCursorException('not-a-real-cursor', cause);
    expect(error.name).toBe('InvalidCursorException');
    expect(error.getStatus()).toBe(400);
    expect(error.cursor).toBe('not-a-real-cursor');
    expect(error.cause).toBe(cause);
  });

  it('InvalidPaginationArgsException reports the conflicting args', () => {
    const error = new InvalidPaginationArgsException('Provide either "first" or "last", not both.', { first: 10, last: 5 });
    expect(error.name).toBe('InvalidPaginationArgsException');
    expect(error.getStatus()).toBe(400);
    expect(error.args).toEqual({ first: 10, last: 5 });
  });
});
