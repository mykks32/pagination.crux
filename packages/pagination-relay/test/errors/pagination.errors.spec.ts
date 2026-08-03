import { InvalidCursorException, InvalidPaginationArgsException } from '../../src/errors/pagination.errors';

describe('pagination.errors', () => {
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
