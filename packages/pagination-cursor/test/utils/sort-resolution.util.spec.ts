import { resolveSort, resolveSortDirection, resolveSortField } from '../../src/utils/sort-resolution.util';
import { InvalidSortFieldException } from '../../src/errors/pagination.errors';

const FIELDS = ['createdAt', 'updatedAt', 'title'] as const;

describe('sort-resolution.util', () => {
  describe('resolveSortDirection', () => {
    it('defaults to DESC when order is omitted', () => {
      expect(resolveSortDirection(undefined)).toBe('DESC');
    });

    it('maps asc/desc to ASC/DESC', () => {
      expect(resolveSortDirection('asc')).toBe('ASC');
      expect(resolveSortDirection('desc')).toBe('DESC');
    });
  });

  describe('resolveSortField', () => {
    it('falls back to the default field when omitted', () => {
      expect(resolveSortField(undefined, FIELDS, 'createdAt')).toBe('createdAt');
    });

    it('accepts a whitelisted field', () => {
      expect(resolveSortField('title', FIELDS, 'createdAt')).toBe('title');
    });

    it('throws InvalidSortFieldException for a non-whitelisted field', () => {
      expect(() => resolveSortField('secret', FIELDS, 'createdAt')).toThrow(InvalidSortFieldException);
    });
  });

  describe('resolveSort', () => {
    it('combines field and direction resolution', () => {
      expect(resolveSort({ sort: 'title', order: 'asc' }, FIELDS, 'createdAt')).toEqual({
        field: 'title',
        direction: 'ASC',
      });
    });

    it('applies both defaults when the query is empty', () => {
      expect(resolveSort({}, FIELDS, 'createdAt')).toEqual({ field: 'createdAt', direction: 'DESC' });
    });
  });
});
