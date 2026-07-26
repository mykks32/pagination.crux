import { toPaginatedResponse } from '../src/to-paginated-response.util';

describe('toPaginatedResponse', () => {
  const pageInfo = { hasNextPage: true, hasPreviousPage: false, startCursor: 'start', endCursor: 'end' };

  it('assembles data/meta/links from the page info and mapped items', () => {
    const result = toPaginatedResponse('/v1/things', { first: 10 }, pageInfo, [{ id: '1' }], 42);

    expect(result).toEqual({
      data: [{ id: '1' }],
      meta: { count: 42, hasNextPage: true, hasPreviousPage: false, startCursor: 'start', endCursor: 'end' },
      links: { self: '/v1/things?first=10', previous: null, next: '/v1/things?first=10&after=end' },
    });
  });

  it('leaves meta.count undefined when no total count is supplied', () => {
    const result = toPaginatedResponse('/v1/things', {}, pageInfo, []);
    expect(result.meta.count).toBeUndefined();
  });
});
