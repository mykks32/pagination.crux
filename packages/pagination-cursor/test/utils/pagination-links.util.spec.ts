import { buildPaginatedLinks } from '../../src/utils/pagination-links.util';

describe('buildPaginatedLinks', () => {
  const pageInfo = {
    hasNextPage: true,
    hasPreviousPage: true,
    startCursor: 'start-cursor',
    endCursor: 'end-cursor',
  };

  it('builds self from exactly the pagination params the caller sent', () => {
    const links = buildPaginatedLinks('/v1/things', { first: 20, after: 'prev-cursor' }, pageInfo);
    expect(links.self).toBe('/v1/things?first=20&after=prev-cursor');
  });

  it('builds next using the resolved page size and the endCursor', () => {
    const links = buildPaginatedLinks('/v1/things', { first: 20 }, pageInfo);
    expect(links.next).toBe('/v1/things?first=20&after=end-cursor');
  });

  it('builds previous using the resolved page size and the startCursor', () => {
    const links = buildPaginatedLinks('/v1/things', { first: 20 }, pageInfo);
    expect(links.previous).toBe('/v1/things?last=20&before=start-cursor');
  });

  it('omits next/previous when there is no such page', () => {
    const links = buildPaginatedLinks('/v1/things', { first: 20 }, { ...pageInfo, hasNextPage: false, hasPreviousPage: false });
    expect(links.next).toBeNull();
    expect(links.previous).toBeNull();
  });

  it('carries non-pagination params (search/sort/filters) onto every generated link', () => {
    const links = buildPaginatedLinks('/v1/things', { first: 20, search: 'foo', sort: 'name' }, pageInfo);
    expect(links.self).toContain('search=foo');
    expect(links.self).toContain('sort=name');
    expect(links.next).toContain('search=foo');
    expect(links.previous).toContain('sort=name');
  });

  it('falls back to the library default page size when neither first nor last was given', () => {
    const links = buildPaginatedLinks('/v1/things', {}, pageInfo);
    expect(links.next).toMatch(/first=\d+&after=end-cursor/);
  });
});
