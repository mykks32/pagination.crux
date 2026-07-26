import { toOffsetPaginatedResponse } from '../src/to-offset-paginated-response.util';

describe('toOffsetPaginatedResponse', () => {
  it('assembles data/meta/links from an OffsetPage', () => {
    const page = {
      data: [{ id: '1' }],
      meta: { page: 1, limit: 20, count: 1, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
    };

    const result = toOffsetPaginatedResponse('/v1/things', { page: 1, limit: 20 }, page);

    expect(result.data).toEqual(page.data);
    expect(result.meta).toEqual(page.meta);
    expect(result.links).toEqual({
      self: '/v1/things?limit=20&page=1',
      first: '/v1/things?limit=20&page=1',
      previous: null,
      next: null,
      last: '/v1/things?limit=20&page=1',
    });
  });
});
