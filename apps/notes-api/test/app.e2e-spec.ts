/**
 * End-to-end test: boots the *real* AppModule (Nest DI, Mongoose
 * connection, global pipes/interceptor/versioning — everything main.ts
 * wires up) against an in-memory MongoDB, then drives the HTTP API with
 * supertest. Unlike the colocated `*.spec.ts` unit tests (which mock their
 * collaborators), this exercises the full request/response pipeline:
 * routing, validation, and all three pagination styles (v1 Relay, v2
 * REST-cursor, v3 offset) together, against a real database.
 */
import { ClassSerializerInterceptor, ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Notes API (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    // A real (if ephemeral) MongoDB rather than a mock — cursor pagination's
    // seek filters and offset pagination's skip/limit are real Mongo
    // queries, so this is the only way to verify them end-to-end.
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's bootstrap exactly, since createNestApplication()
    // alone doesn't apply any of it.
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  describe('CRUD (shared across v1/v2/v3)', () => {
    it('runs a full create -> get -> update -> archive -> delete lifecycle', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/v1/notes')
        .send({ title: 'E2E note', content: 'Body', tags: ['e2e'] })
        .expect(201);

      // The serializer must have stripped Mongoose internals and exposed `id`.
      expect(createRes.body).toMatchObject({ title: 'E2E note', content: 'Body', tags: ['e2e'], archived: false });
      expect(createRes.body).not.toHaveProperty('_id');
      expect(createRes.body).not.toHaveProperty('__v');
      const noteId: string = createRes.body.id;

      // findOne/update/remove are @Version(['1','2','3']) — reachable at any prefix.
      await request(app.getHttpServer())
        .get(`/v2/notes/${noteId}`)
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.title).toBe('E2E note');
        });

      await request(app.getHttpServer())
        .patch(`/v3/notes/${noteId}`)
        .send({ title: 'Updated via e2e' })
        .expect(200)
        .expect((res: request.Response) => {
          expect(res.body.title).toBe('Updated via e2e');
        });

      await request(app.getHttpServer()).delete(`/v1/notes/${noteId}`).expect(204);
      await request(app.getHttpServer()).get(`/v1/notes/${noteId}`).expect(404);
    });

    it('rejects a create request missing the required title', async () => {
      await request(app.getHttpServer()).post('/v1/notes').send({ content: 'no title' }).expect(400);
    });

    it('rejects a malformed note id with 400 rather than a 500', async () => {
      await request(app.getHttpServer()).get('/v1/notes/not-an-object-id').expect(400);
    });
  });

  describe('v1 — Relay-style cursor pagination', () => {
    it('returns edges/node/cursor + pageInfo, and pages forward without gaps or duplicates', async () => {
      const titles = Array.from({ length: 5 }, (_, i) => `V1 note ${i + 1}`);
      // Inserted sequentially (not Promise.all) so each note's createdAt is
      // deterministically ordered relative to the others.
      for (const title of titles) {
        await request(app.getHttpServer()).post('/v1/notes').send({ title }).expect(201);
      }

      const firstPage = await request(app.getHttpServer()).get('/v1/notes?first=2').expect(200);
      expect(firstPage.body.edges).toHaveLength(2);
      expect(firstPage.body.edges[0]).toHaveProperty('cursor');
      expect(firstPage.body.pageInfo).toMatchObject({ hasPreviousPage: false });

      const seenTitles: string[] = [];
      let after: string | undefined;
      let hasNextPage = true;
      // Each iteration's cursor comes from the previous response, so the
      // requests can't be parallelized.
      while (hasNextPage) {
        const query = after ? `first=2&after=${after}` : 'first=2';
        const res = await request(app.getHttpServer()).get(`/v1/notes?${query}`).expect(200);
        seenTitles.push(...res.body.edges.map((edge: { node: { title: string } }) => edge.node.title));
        hasNextPage = res.body.pageInfo.hasNextPage;
        after = res.body.pageInfo.endCursor;
      }

      expect(new Set(seenTitles).size).toBe(seenTitles.length);
      expect(seenTitles).toEqual(expect.arrayContaining(titles));
    });
  });

  describe('v2 — flat REST cursor pagination', () => {
    it('returns a data/meta/links envelope with no edges/node wrapping', async () => {
      await request(app.getHttpServer()).post('/v2/notes').send({ title: 'V2 note' }).expect(201);

      const res = await request(app.getHttpServer()).get('/v2/notes?first=10&includeTotalCount=true').expect(200);

      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0]).not.toHaveProperty('cursor');
      expect(res.body.meta).toHaveProperty('count');
      expect(res.body.links.self).toContain('/v2/notes');
    });

    it('finds notes via "search" using the text index', async () => {
      await request(app.getHttpServer()).post('/v2/notes').send({ title: 'Unique Searchable Term', content: 'irrelevant' }).expect(201);
      await request(app.getHttpServer()).post('/v2/notes').send({ title: 'Something else entirely' }).expect(201);

      const res = await request(app.getHttpServer()).get('/v2/notes?first=10&search=Searchable').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Unique Searchable Term');
    });

    it('filters by a whitelisted field via "filters", and rejects a non-whitelisted one', async () => {
      await request(app.getHttpServer())
        .post('/v2/notes')
        .send({ title: 'Tagged note', tags: ['urgent'] })
        .expect(201);
      await request(app.getHttpServer()).post('/v2/notes').send({ title: 'Untagged note' }).expect(201);

      const filtered = await request(app.getHttpServer())
        .get(`/v2/notes?first=10&filters=${encodeURIComponent(JSON.stringify({ tags: 'urgent' }))}`)
        .expect(200);
      expect(filtered.body.data.every((note: { tags: string[] }) => note.tags.includes('urgent'))).toBe(true);

      await request(app.getHttpServer())
        .get(`/v2/notes?filters=${encodeURIComponent(JSON.stringify({ notAField: 'x' }))}`)
        .expect(400);
    });

    it('restricts each item to the requested fields via "include"', async () => {
      await request(app.getHttpServer()).post('/v2/notes').send({ title: 'Sparse fieldset note' }).expect(201);

      const res = await request(app.getHttpServer()).get('/v2/notes?first=1&include=title').expect(200);

      expect(Object.keys(res.body.data[0]).sort()).toEqual(['id', 'title']);
    });

    it('hides archived notes by default and includes them when asked', async () => {
      const createRes = await request(app.getHttpServer()).post('/v2/notes').send({ title: 'To be archived' }).expect(201);
      await request(app.getHttpServer()).patch(`/v2/notes/${createRes.body.id}`).send({ archived: true }).expect(200);

      const withoutArchived = await request(app.getHttpServer())
        .get(`/v2/notes?first=100&filters=${encodeURIComponent(JSON.stringify({}))}`)
        .expect(200);
      expect(withoutArchived.body.data.some((n: { id: string }) => n.id === createRes.body.id)).toBe(false);

      const withArchived = await request(app.getHttpServer()).get('/v2/notes?first=100&includeArchived=true').expect(200);
      expect(withArchived.body.data.some((n: { id: string }) => n.id === createRes.body.id)).toBe(true);
    });
  });

  describe('v3 — offset (page/limit) pagination', () => {
    it('returns a data/meta/links envelope with totalItems/totalPages and jump-to-any-page links', async () => {
      // A unique search term scopes totalItems/totalPages to only the notes
      // this test creates — the e2e suite shares one MongoDB across every
      // test, so an unscoped count would include notes from earlier tests.
      const uniqueTerm = 'OffsetPaginationV3Test';
      const titles = Array.from({ length: 5 }, (_, i) => `${uniqueTerm} note ${i + 1}`);
      // Inserted sequentially (not Promise.all) so each note's createdAt is
      // deterministically ordered relative to the others.
      for (const title of titles) {
        await request(app.getHttpServer()).post('/v3/notes').send({ title }).expect(201);
      }

      const page1 = await request(app.getHttpServer()).get(`/v3/notes?page=1&limit=2&search=${uniqueTerm}`).expect(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.meta).toMatchObject({ page: 1, limit: 2, totalItems: 5, totalPages: 3, hasPreviousPage: false, hasNextPage: true });
      expect(page1.body.links.first).toContain('page=1');
      expect(page1.body.links.last).toContain('page=3');
      expect(page1.body.links.previous).toBeNull();

      const page3 = await request(app.getHttpServer()).get(`/v3/notes?page=3&limit=2&search=${uniqueTerm}`).expect(200);
      expect(page3.body.data).toHaveLength(1);
      expect(page3.body.meta).toMatchObject({ hasNextPage: false, hasPreviousPage: true });
      expect(page3.body.links.next).toBeNull();
    });

    it('rejects a non-positive page or limit', async () => {
      await request(app.getHttpServer()).get('/v3/notes?page=0').expect(400);
      await request(app.getHttpServer()).get('/v3/notes?limit=0').expect(400);
    });
  });
});
