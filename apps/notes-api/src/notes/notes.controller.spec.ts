/**
 * Unit tests for NotesController. NotesService is mocked entirely — this
 * suite is only about the controller's own job: forwarding to the service
 * and re-shaping the result through NoteResponseDto (dropping Mongoose
 * internals like `_id`/`__v` in favor of a clean `id` field).
 */
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import type { NoteDocument } from './schemas/note.schema';

describe('NotesController', () => {
  let controller: NotesController;
  let notesService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  /** Builds a fake hydrated document with just the fields NoteResponseDto.fromDocument reads. */
  function fakeNoteDocument(overrides: Partial<NoteDocument> = {}): NoteDocument {
    return {
      _id: new Types.ObjectId(),
      title: 'Title',
      content: 'Content',
      tags: ['tag'],
      archived: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      ...overrides,
    } as NoteDocument;
  }

  beforeEach(async () => {
    notesService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [{ provide: NotesService, useValue: notesService }],
    }).compile();

    controller = moduleRef.get(NotesController);
  });

  describe('create', () => {
    it('creates via the service and serializes the result, dropping Mongoose-internal fields', async () => {
      const doc = fakeNoteDocument();
      notesService.create.mockResolvedValue(doc);

      const result = await controller.create({ title: 'Title', content: 'Content', tags: ['tag'] });

      expect(notesService.create).toHaveBeenCalledWith({ title: 'Title', content: 'Content', tags: ['tag'] });
      expect(result).toEqual({
        id: doc._id.toString(),
        title: doc.title,
        content: doc.content,
        tags: doc.tags,
        archived: doc.archived,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      });
      expect(result).not.toHaveProperty('_id');
    });
  });

  describe('findAll', () => {
    it('maps every edge.node through NoteResponseDto while passing pageInfo/totalCount through untouched', async () => {
      const doc = fakeNoteDocument();
      const page = {
        edges: [{ cursor: 'cursor-1', node: doc }],
        pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: 'cursor-1', endCursor: 'cursor-1' },
        totalCount: 42,
      };
      notesService.findAll.mockResolvedValue(page);

      const query = { first: 10 };
      const result = await controller.findAll(query);

      expect(notesService.findAll).toHaveBeenCalledWith(query);
      expect(result.pageInfo).toBe(page.pageInfo);
      expect(result.totalCount).toBe(42);
      expect(result.edges).toEqual([{ cursor: 'cursor-1', node: expect.objectContaining({ id: doc._id.toString() }) }]);
      expect(result.edges[0].node).not.toHaveProperty('_id');
    });

    it('returns an empty edges array untouched when the service returns no results', async () => {
      const page = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
      notesService.findAll.mockResolvedValue(page);

      const result = await controller.findAll({});

      expect(result.edges).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('serializes the single note returned by the service', async () => {
      const doc = fakeNoteDocument({ title: 'Found me' });
      notesService.findOne.mockResolvedValue(doc);

      const result = await controller.findOne(doc._id.toString());

      expect(notesService.findOne).toHaveBeenCalledWith(doc._id.toString());
      expect(result.title).toBe('Found me');
    });
  });

  describe('update', () => {
    it('forwards the dto and serializes the updated note', async () => {
      const doc = fakeNoteDocument({ title: 'Updated' });
      notesService.update.mockResolvedValue(doc);

      const result = await controller.update(doc._id.toString(), { title: 'Updated' });

      expect(notesService.update).toHaveBeenCalledWith(doc._id.toString(), { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });
  });

  describe('remove', () => {
    it('delegates to the service and returns nothing (204 is set via @HttpCode)', async () => {
      const id = new Types.ObjectId().toHexString();
      notesService.remove.mockResolvedValue(undefined);

      await expect(controller.remove(id)).resolves.toBeUndefined();
      expect(notesService.remove).toHaveBeenCalledWith(id);
    });
  });
});
