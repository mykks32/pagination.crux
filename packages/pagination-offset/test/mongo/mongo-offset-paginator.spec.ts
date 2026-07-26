import type { Model } from 'mongoose';
import { InvalidOffsetPaginationArgsException } from '../../src/errors/pagination.errors';
import { paginate } from '../../src/mongo/mongo-offset-paginator';

interface Doc {
  _id: string;
  createdAt: Date;
}

function doc(_id: string, createdAt: string): Doc {
  return { _id, createdAt: new Date(createdAt) };
}

/** Minimal chainable stand-in for a Mongoose `Query`, mirroring find().sort().skip().limit().exec(). */
function createModelMock(allDocsInSortOrder: Doc[]) {
  const find = jest.fn(() => ({
    sort: jest.fn((sortSpec: Record<string, 1 | -1>) => {
      const sorted = [...allDocsInSortOrder].sort((a, b) => compareBySort(a, b, sortSpec));
      return {
        skip: jest.fn((n: number) => ({
          limit: jest.fn((limit: number) => ({
            exec: jest.fn(async () => sorted.slice(n, n + limit)),
          })),
        })),
      };
    }),
  }));

  const countDocuments = jest.fn(() => ({
    exec: jest.fn(async () => allDocsInSortOrder.length),
  }));

  return { find, countDocuments } as unknown as Model<Doc>;
}

function compareBySort(a: Doc, b: Doc, sortSpec: Record<string, 1 | -1>): number {
  for (const [field, dir] of Object.entries(sortSpec)) {
    const av = (a as unknown as Record<string, unknown>)[field];
    const bv = (b as unknown as Record<string, unknown>)[field];
    if (av === bv) continue;
    return (av! > bv! ? 1 : -1) * dir;
  }
  return 0;
}

describe('paginate (Mongo offset paginator)', () => {
  const docs = [doc('1', '2026-01-01'), doc('2', '2026-01-02'), doc('3', '2026-01-03'), doc('4', '2026-01-04'), doc('5', '2026-01-05')];
  const sort = [{ field: 'createdAt', direction: 'ASC' as const }];

  it('returns page 1 by default, with hasPreviousPage=false and hasNextPage=true', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { limit: 2 }, sort });

    expect(result.data.map((d) => d._id)).toEqual(['1', '2']);
    expect(result.meta).toMatchObject({
      page: 1,
      limit: 2,
      count: 2,
      totalItems: 5,
      totalPages: 3,
      hasPreviousPage: false,
      hasNextPage: true,
    });
  });

  it('computes skip from page and limit', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { page: 2, limit: 2 }, sort });

    expect(result.data.map((d) => d._id)).toEqual(['3', '4']);
    expect(result.meta).toMatchObject({ hasPreviousPage: true, hasNextPage: true });
  });

  it('reaches the last page with hasNextPage=false and a partial count', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { page: 3, limit: 2 }, sort });

    expect(result.data.map((d) => d._id)).toEqual(['5']);
    expect(result.meta).toMatchObject({ count: 1, hasNextPage: false, totalPages: 3 });
  });

  it('returns totalPages=0 and an empty page when the collection matches nothing', async () => {
    const model = createModelMock([]);
    const result = await paginate(model, { args: {}, sort });

    expect(result.data).toEqual([]);
    expect(result.meta).toMatchObject({ totalItems: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false });
  });

  it('rejects a non-positive page', async () => {
    const model = createModelMock(docs);
    await expect(paginate(model, { args: { page: 0 }, sort })).rejects.toThrow(InvalidOffsetPaginationArgsException);
  });

  it('rejects a non-positive limit', async () => {
    const model = createModelMock(docs);
    await expect(paginate(model, { args: { limit: 0 }, sort })).rejects.toThrow(InvalidOffsetPaginationArgsException);
  });

  it('clamps limits above MAX_LIMIT', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { limit: 10_000 }, sort });
    expect(result.data).toHaveLength(docs.length);
    expect(result.meta.limit).toBe(100);
  });
});
