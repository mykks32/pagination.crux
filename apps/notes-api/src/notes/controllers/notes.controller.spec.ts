/**
 * Unit tests for NotesController. NotesService is mocked entirely — this
 * suite is only about the controller's own job: forwarding to the service
 * and re-shaping the result through NoteSerializer (dropping Mongoose
 * internals like `_id`/`__v` in favor of a clean `id` field).
 */
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';
import { NotesController } from './notes.controller';
import { NotesService } from '../services/notes.service';
import type { NoteDocument } from '../schemas/note.schema';

describe('NotesController', () => {
  let controller: NotesController;
  let notesService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findAllCursor: jest.Mock;
    findAllOffset: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  /** Builds a fake hydrated document with just the fields NoteSerializer exposes. */
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
      findAllCursor: jest.fn(),
      findAllOffset: jest.fn(),
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

  describe('findAll (v1, Relay-style)', () => {
    it('maps every edge.node through NoteSerializer while passing pageInfo/totalCount through untouched', async () => {
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
  });

  describe("findAllCursor (v2, flat REST envelope, pagination-cursor's own engine)", () => {
    it('maps every row through NoteSerializer into a flat data array, with meta/links built from pageInfo', async () => {
      const doc = fakeNoteDocument();
      const page = {
        rows: [doc],
        pageInfo: { hasNextPage: true, hasPreviousPage: false, startCursor: 'cursor-1', endCursor: 'cursor-1' },
        totalCount: 42,
      };
      notesService.findAllCursor.mockResolvedValue(page);

      const query = { first: 10 };
      const result = await controller.findAllCursor(query);

      expect(notesService.findAllCursor).toHaveBeenCalledWith(query);
      expect(notesService.findAll).not.toHaveBeenCalled();
      expect(result.meta).toEqual({
        count: 42,
        hasNextPage: true,
        hasPreviousPage: false,
        startCursor: 'cursor-1',
        endCursor: 'cursor-1',
      });
      expect(result.data).toEqual([expect.objectContaining({ id: doc._id.toString() })]);
      expect(result.data[0]).not.toHaveProperty('_id');
      expect(result.links.self).toContain('/v2/notes');
      expect(result.links.next).toContain('after=cursor-1');
      expect(result.links.previous).toBeNull();
    });

    it('returns an empty data array when the service returns no results', async () => {
      const page = { rows: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
      notesService.findAllCursor.mockResolvedValue(page);

      const result = await controller.findAllCursor({});

      expect(result.data).toEqual([]);
      expect(result.links.next).toBeNull();
    });

    it('applies "include" to restrict each item to the requested fields plus id', async () => {
      const doc = fakeNoteDocument();
      const page = {
        rows: [doc],
        pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: 'cursor-1', endCursor: 'cursor-1' },
      };
      notesService.findAllCursor.mockResolvedValue(page);

      const result = await controller.findAllCursor({ include: ['title'] });

      expect(result.data[0]).toEqual({ id: doc._id.toString(), title: doc.title });
    });
  });

  describe('findAllOffset (v3, page/limit)', () => {
    it('maps every item through NoteSerializer into a flat data array, with meta/links built from the offset page', async () => {
      const doc = fakeNoteDocument();
      const page = {
        data: [doc],
        meta: { page: 1, limit: 20, count: 1, totalItems: 1, totalPages: 1, hasPreviousPage: false, hasNextPage: false },
      };
      notesService.findAllOffset.mockResolvedValue(page);

      const query = { page: 1, limit: 20 };
      const result = await controller.findAllOffset(query);

      expect(notesService.findAllOffset).toHaveBeenCalledWith(query);
      expect(result.meta).toEqual(page.meta);
      expect(result.data).toEqual([expect.objectContaining({ id: doc._id.toString() })]);
      expect(result.links.self).toContain('/v3/notes');
      expect(result.links.first).toContain('/v3/notes');
      expect(result.links.previous).toBeNull();
      expect(result.links.next).toBeNull();
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
