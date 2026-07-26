import { InvalidFilterException, InvalidSortFieldException } from '../../src/errors/pagination.errors';

describe('pagination.errors', () => {
  it('InvalidSortFieldException reports the allowed fields', () => {
    const error = new InvalidSortFieldException('secret', ['title', 'createdAt']);
    expect(error.name).toBe('InvalidSortFieldException');
    expect(error.getStatus()).toBe(400);
    expect(error.message).toContain('title, createdAt');
    expect(error.message).toContain('secret');
  });

  it('InvalidFilterException carries the given message', () => {
    const error = new InvalidFilterException('"secret" is not a filterable field.');
    expect(error.name).toBe('InvalidFilterException');
    expect(error.getStatus()).toBe(400);
    expect(error.message).toBe('"secret" is not a filterable field.');
  });
});
