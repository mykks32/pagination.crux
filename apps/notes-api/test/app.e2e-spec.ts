/**
 * End-to-end test: boots the *real* AppModule (Nest DI, Mongoose
 * connection, global pipes/interceptor/versioning — everything main.ts
 * wires up) against an in-memory MongoDB, then drives the HTTP API with
 * supertest. Unlike the colocated `*.spec.ts` unit tests (which mock their
 * collaborators), this exercises the full request/response pipeline:
 * routing, validation, cursor pagination, and response serialization
 * together.
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
    // seek filters are real Mongo queries, so this is the only way to
    // verify them end-to-end.
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

  it('runs a full create -> list -> get -> update -> archive -> delete lifecycle', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/notes')
      .send({ title: 'E2E note', content: 'Body', tags: ['e2e'] })
      .expect(201);

    // The serializer must have stripped Mongoose internals and exposed `id`.
    expect(createRes.body).toMatchObject({ title: 'E2E note', content: 'Body', tags: ['e2e'], archived: false });
    expect(createRes.body).not.toHaveProperty('_id');
    expect(createRes.body).not.toHaveProperty('__v');
    const noteId: string = createRes.body.id;

    const listRes = await request(app.getHttpServer()).get('/v1/notes?first=10').expect(200);
    expect(listRes.body.edges).toHaveLength(1);
    expect(listRes.body.edges[0].node.id).toBe(noteId);
    expect(listRes.body.pageInfo).toMatchObject({ hasNextPage: false, hasPreviousPage: false });

    await request(app.getHttpServer())
      .get(`/v1/notes/${noteId}`)
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.title).toBe('E2E note');
      });

    await request(app.getHttpServer())
      .patch(`/v1/notes/${noteId}`)
      .send({ title: 'Updated via e2e' })
      .expect(200)
      .expect((res: request.Response) => {
        expect(res.body.title).toBe('Updated via e2e');
      });

    // Archiving hides the note from the default (includeArchived=false) list...
    await request(app.getHttpServer()).patch(`/v1/notes/${noteId}`).send({ archived: true }).expect(200);
    const listAfterArchive = await request(app.getHttpServer()).get('/v1/notes?first=10').expect(200);
    expect(listAfterArchive.body.edges).toHaveLength(0);

    // ...but it's still there when explicitly asked for.
    const listIncludingArchived = await request(app.getHttpServer()).get('/v1/notes?first=10&includeArchived=true').expect(200);
    expect(listIncludingArchived.body.edges).toHaveLength(1);

    await request(app.getHttpServer()).delete(`/v1/notes/${noteId}`).expect(204);
    await request(app.getHttpServer()).get(`/v1/notes/${noteId}`).expect(404);
  });

  it('cursor-paginates forward across multiple pages without skipping or repeating notes', async () => {
    const titles = Array.from({ length: 5 }, (_, i) => `Page note ${i + 1}`);
    // Inserted sequentially (not Promise.all) so each note's createdAt is
    // deterministically ordered relative to the others.
    for (const title of titles) {
      await request(app.getHttpServer()).post('/v1/notes').send({ title }).expect(201);
    }

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

    expect(seenTitles).toHaveLength(titles.length);
    expect(new Set(seenTitles).size).toBe(titles.length);
  });

  it('rejects a create request missing the required title', async () => {
    await request(app.getHttpServer()).post('/v1/notes').send({ content: 'no title' }).expect(400);
  });

  it('rejects a malformed note id with 400 rather than a 500', async () => {
    await request(app.getHttpServer()).get('/v1/notes/not-an-object-id').expect(400);
  });
});
