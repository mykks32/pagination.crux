import type { Model } from 'mongoose';
import { InvalidPaginationArgsException } from '../../src/errors/pagination.errors';
import { decodeCursor, encodeCursor } from '../../src/utils/cursor.util';
import { paginate } from '../../src/mongo/mongo-cursor-paginator';

interface Doc {
  _id: string;
  createdAt: Date;
}

function doc(_id: string, createdAt: string): Doc {
  return { _id, createdAt: new Date(createdAt) };
}

/** Minimal chainable stand-in for a Mongoose `Query`, mirroring find().sort().limit().exec(). */
function createModelMock(allDocsInSortOrder: Doc[]) {
  const find = jest.fn((filter: Record<string, unknown> = {}) => {
    const matches = allDocsInSortOrder.filter((candidate) => matchesFilter(candidate, filter));
    const query = {
      sort: jest.fn((sortSpec: Record<string, 1 | -1>) => {
        const sorted = [...matches].sort((a, b) => compareBySort(a, b, sortSpec));
        return {
          limit: jest.fn((n: number) => ({
            exec: jest.fn(async () => sorted.slice(0, n)),
          })),
        };
      }),
    };
    return query;
  });

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

function matchesFilter(candidate: Doc, filter: Record<string, unknown>): boolean {
  if (filter.$and) {
    return (filter.$and as Record<string, unknown>[]).every((sub) => matchesFilter(candidate, sub));
  }
  if (filter.$or) {
    return (filter.$or as Record<string, unknown>[]).some((sub) => matchesFilter(candidate, sub));
  }
  return Object.entries(filter).every(([field, condition]) => {
    const value = (candidate as unknown as Record<string, unknown>)[field];
    if (condition !== null && typeof condition === 'object') {
      return Object.entries(condition as Record<string, unknown>).every(([op, opValue]) => {
        const comparable = value as string | number | Date;
        const comparableOpValue = opValue as string | number | Date;
        if (op === '$gt') return comparable > comparableOpValue;
        if (op === '$lt') return comparable < comparableOpValue;
        return true;
      });
    }
    return value === condition;
  });
}

describe('paginate (Mongo cursor paginator)', () => {
  const docs = [doc('1', '2026-01-01'), doc('2', '2026-01-02'), doc('3', '2026-01-03'), doc('4', '2026-01-04'), doc('5', '2026-01-05')];
  const sort = [{ field: 'createdAt', direction: 'ASC' as const }];

  it('returns the first page with hasNextPage=true and hasPreviousPage=false', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { first: 2 }, sort });

    expect(result.rows.map((row) => row._id)).toEqual(['1', '2']);
    expect(result.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: false });
  });

  it('pages forward using the previous page endCursor', async () => {
    const model = createModelMock(docs);
    const firstPage = await paginate(model, { args: { first: 2 }, sort });
    const secondPage = await paginate(model, { args: { first: 2, after: firstPage.pageInfo.endCursor! }, sort });

    expect(secondPage.rows.map((row) => row._id)).toEqual(['3', '4']);
    expect(secondPage.pageInfo).toMatchObject({ hasNextPage: true, hasPreviousPage: true });
  });

  it('reaches the last page with hasNextPage=false', async () => {
    const model = createModelMock(docs);
    const secondPage = await paginate(model, { args: { first: 2, after: encodeCursor([docs[3].createdAt, docs[3]._id]) }, sort });
    expect(secondPage.rows.map((row) => row._id)).toEqual(['5']);
    expect(secondPage.pageInfo.hasNextPage).toBe(false);
  });

  it('pages backward from a "before" cursor and returns rows in ascending order', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { last: 2, before: encodeCursor([docs[4].createdAt, docs[4]._id]) }, sort });

    expect(result.rows.map((row) => row._id)).toEqual(['3', '4']);
    expect(result.pageInfo).toMatchObject({ hasPreviousPage: true, hasNextPage: true });
  });

  it('derives startCursor/endCursor from the sort field values of the first/last row', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { first: 2 }, sort });
    expect(decodeCursor(result.pageInfo.startCursor!).values).toEqual([docs[0].createdAt, docs[0]._id]);
    expect(decodeCursor(result.pageInfo.endCursor!).values).toEqual([docs[1].createdAt, docs[1]._id]);
  });

  it('includes totalCount only when requested', async () => {
    const model = createModelMock(docs);
    const withCount = await paginate(model, { args: { first: 1 }, sort, includeTotalCount: true });
    const withoutCount = await paginate(model, { args: { first: 1 }, sort });

    expect(withCount.totalCount).toBe(docs.length);
    expect(withoutCount.totalCount).toBeUndefined();
  });

  it('rejects combining "first" and "last"', async () => {
    const model = createModelMock(docs);
    await expect(paginate(model, { args: { first: 1, last: 1 }, sort })).rejects.toThrow(InvalidPaginationArgsException);
  });

  it('rejects a non-positive limit', async () => {
    const model = createModelMock(docs);
    await expect(paginate(model, { args: { first: 0 }, sort })).rejects.toThrow(InvalidPaginationArgsException);
  });

  it('clamps limits above MAX_PAGE_SIZE', async () => {
    const model = createModelMock(docs);
    const result = await paginate(model, { args: { first: 10_000 }, sort });
    expect(result.rows).toHaveLength(docs.length);
  });
});
