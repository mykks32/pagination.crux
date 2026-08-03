import { InvalidOffsetPaginationArgsException } from '../../src/errors/pagination.errors';

describe('pagination.errors', () => {
  it('InvalidOffsetPaginationArgsException reports the offending raw value', () => {
    const error = new InvalidOffsetPaginationArgsException('"page" must be a positive integer.', -1);
    expect(error.name).toBe('InvalidOffsetPaginationArgsException');
    expect(error.getStatus()).toBe(400);
    expect(error.received).toBe(-1);
  });
});
