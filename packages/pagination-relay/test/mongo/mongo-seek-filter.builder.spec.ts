import { buildSeekFilter } from '../../src/mongo/mongo-seek-filter.builder';

describe('buildSeekFilter', () => {
  it('builds a single-field seek filter for forward pagination on ASC sort', () => {
    const filter = buildSeekFilter([{ field: '_id', direction: 'ASC' }], ['abc123'], 'after');
    expect(filter).toEqual({ $or: [{ _id: { $gt: 'abc123' } }] });
  });

  it('flips the operator for DESC sort fields', () => {
    const filter = buildSeekFilter([{ field: 'createdAt', direction: 'DESC' }], [100], 'after');
    expect(filter).toEqual({ $or: [{ createdAt: { $lt: 100 } }] });
  });

  it('flips the operator again when seeking backward ("before")', () => {
    const filter = buildSeekFilter([{ field: 'createdAt', direction: 'DESC' }], [100], 'before');
    expect(filter).toEqual({ $or: [{ createdAt: { $gt: 100 } }] });
  });

  it('builds a compound keyset filter with equality prefixes for multi-field sort', () => {
    const filter = buildSeekFilter(
      [
        { field: 'createdAt', direction: 'DESC' },
        { field: '_id', direction: 'DESC' },
      ],
      [100, 'abc123'],
      'after',
    );

    expect(filter).toEqual({
      $or: [{ createdAt: { $lt: 100 } }, { createdAt: 100, _id: { $lt: 'abc123' } }],
    });
  });

  it('throws when sort fields and cursor values are misaligned', () => {
    expect(() => buildSeekFilter([{ field: '_id', direction: 'ASC' }], [], 'after')).toThrow();
  });
});
