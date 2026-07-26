import { buildOffsetLinks } from '../../src/utils/offset-links.util';

describe('buildOffsetLinks', () => {
  const meta = { page: 2, limit: 20, count: 20, totalItems: 156, totalPages: 8, hasPreviousPage: true, hasNextPage: true };

  it('builds self/first/previous/next/last from the current page and total pages', () => {
    const links = buildOffsetLinks('/v1/users', { page: 2, limit: 20 }, meta);

    expect(links).toEqual({
      self: '/v1/users?limit=20&page=2',
      first: '/v1/users?limit=20&page=1',
      previous: '/v1/users?limit=20&page=1',
      next: '/v1/users?limit=20&page=3',
      last: '/v1/users?limit=20&page=8',
    });
  });

  it('nulls previous on the first page but still returns a real "first" link', () => {
    const links = buildOffsetLinks('/v1/users', { page: 1, limit: 20 }, { ...meta, page: 1, hasPreviousPage: false });
    expect(links.previous).toBeNull();
    expect(links.first).toBe('/v1/users?limit=20&page=1');
  });

  it('nulls next on the last page but still returns a real "last" link', () => {
    const links = buildOffsetLinks('/v1/users', { page: 8, limit: 20 }, { ...meta, page: 8, hasNextPage: false });
    expect(links.next).toBeNull();
    expect(links.last).toBe('/v1/users?limit=20&page=8');
  });

  it('carries non-page params (search/sort/filters) onto every generated link', () => {
    const links = buildOffsetLinks('/v1/users', { page: 2, limit: 20, search: 'jane' }, meta);
    expect(links.self).toContain('search=jane');
    expect(links.next).toContain('search=jane');
    expect(links.last).toContain('search=jane');
  });
});
