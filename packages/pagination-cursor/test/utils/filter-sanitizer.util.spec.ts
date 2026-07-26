import { sanitizeFilters } from '../../src/utils/filter-sanitizer.util';
import { InvalidFilterException } from '../../src/errors/pagination.errors';

const FILTERABLE_FIELDS = ['title', 'tags', 'archived'] as const;

describe('filter-sanitizer.util', () => {
  it('returns an empty object when filters is undefined', () => {
    expect(sanitizeFilters(undefined, FILTERABLE_FIELDS)).toEqual({});
  });

  it('passes through whitelisted primitive values', () => {
    expect(sanitizeFilters({ tags: 'personal', archived: false }, FILTERABLE_FIELDS)).toEqual({
      tags: 'personal',
      archived: false,
    });
  });

  it('passes through an array of primitives', () => {
    expect(sanitizeFilters({ tags: ['personal', 'work'] }, FILTERABLE_FIELDS)).toEqual({ tags: ['personal', 'work'] });
  });

  it('throws InvalidFilterException for a non-whitelisted field', () => {
    expect(() => sanitizeFilters({ secret: 'x' }, FILTERABLE_FIELDS)).toThrow(InvalidFilterException);
  });

  it('throws InvalidFilterException for a nested object value (Mongo operator injection attempt)', () => {
    expect(() => sanitizeFilters({ tags: { $where: 'this' } }, FILTERABLE_FIELDS)).toThrow(InvalidFilterException);
  });
});
