import { normalizeSortFields, toMongoSortObject } from '../../src/utils/sort.util';

describe('sort.util', () => {
  describe('normalizeSortFields', () => {
    it('defaults to _id ASC when no sort is given', () => {
      expect(normalizeSortFields(undefined)).toEqual([{ field: '_id', direction: 'ASC' }]);
    });

    it('appends _id as a tiebreaker, matching the leading direction', () => {
      const sort = normalizeSortFields([{ field: 'createdAt', direction: 'DESC' }]);
      expect(sort).toEqual([
        { field: 'createdAt', direction: 'DESC' },
        { field: '_id', direction: 'DESC' },
      ]);
    });

    it('does not duplicate an explicit _id sort field', () => {
      const input = [
        { field: 'createdAt', direction: 'DESC' as const },
        { field: '_id', direction: 'ASC' as const },
      ];
      expect(normalizeSortFields(input)).toEqual(input);
    });
  });

  describe('toMongoSortObject', () => {
    it('maps ASC/DESC to 1/-1', () => {
      expect(
        toMongoSortObject([
          { field: 'createdAt', direction: 'DESC' },
          { field: '_id', direction: 'ASC' },
        ]),
      ).toEqual({ createdAt: -1, _id: 1 });
    });
  });
});
