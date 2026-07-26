/**
 * Unit tests for NotesService. The Mongoose model and all three pagination
 * services are provided as jest mocks — this suite is about NotesService's
 * own logic (id validation, not-found handling, how it shapes pagination
 * options), not about Mongoose or the pagination libraries themselves
 * (those are covered by each package's own test suite).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoCursorPaginationService as RelayMongoCursorPaginationService } from '@mykks32/pagination-relay';
import { MongoCursorPaginationService as CursorMongoCursorPaginationService } from '@mykks32/pagination-cursor';
import { MongoOffsetPaginationService } from '@mykks32/pagination-offset';
import { Types } from 'mongoose';
import { NotesService } from './notes.service';
import { Note } from '../schemas/note.schema';

describe('NotesService', () => {
  let service: NotesService;
  // Only the Mongoose Model methods NotesService actually calls are mocked;
  // each returns a chainable `{ exec }` stub to match Mongoose's query API.
  let noteModel: {
    create: jest.Mock;
    findById: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    findByIdAndDelete: jest.Mock;
  };
  let relayPaginationService: { paginate: jest.Mock };
  let cursorPaginationService: { paginate: jest.Mock };
  let offsetPaginationService: { paginate: jest.Mock };

  /** A syntactically valid ObjectId string — distinct per test run so tests can't accidentally rely on id equality. */
  const validId = () => new Types.ObjectId().toHexString();

  beforeEach(async () => {
    noteModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    relayPaginationService = { paginate: jest.fn() };
    cursorPaginationService = { paginate: jest.fn() };
    offsetPaginationService = { paginate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getModelToken(Note.name), useValue: noteModel },
        // Each pagination service is injected by class reference, not a
        // string token, so the mocks have to be provided under those same
        // classes. Relay's and cursor's classes share a name but are
        // distinct references — no collision registering both.
        { provide: RelayMongoCursorPaginationService, useValue: relayPaginationService },
        { provide: CursorMongoCursorPaginationService, useValue: cursorPaginationService },
        { provide: MongoOffsetPaginationService, useValue: offsetPaginationService },
      ],
    }).compile();

    service = moduleRef.get(NotesService);
  });

  describe('create', () => {
    it('persists the dto via the model and returns the created document', async () => {
      const dto = { title: 'Groceries', content: 'Milk, eggs', tags: ['personal'] };
      const created = { _id: validId(), ...dto };
      noteModel.create.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(noteModel.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(created);
    });
  });

  describe('findAll (v1, relay engine)', () => {
    it('defaults to sorting by createdAt DESC and excluding archived notes', async () => {
      const page = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
      relayPaginationService.paginate.mockResolvedValue(page);

      const result = await service.findAll({});

      expect(relayPaginationService.paginate).toHaveBeenCalledWith(noteModel, {
        args: { first: undefined, after: undefined, last: undefined, before: undefined },
        sort: [{ field: 'createdAt', direction: 'DESC' }],
        filter: { archived: false },
        includeTotalCount: false,
      });
      expect(cursorPaginationService.paginate).not.toHaveBeenCalled();
      expect(result).toBe(page);
    });

    it('drops the archived filter when includeArchived is true', async () => {
      relayPaginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ includeArchived: true });

      expect(relayPaginationService.paginate).toHaveBeenCalledWith(noteModel, expect.objectContaining({ filter: {} }));
    });

    it('forwards a custom sort/order and the first/after cursor args untouched', async () => {
      relayPaginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ first: 10, after: 'cursor-abc', sort: 'title', order: 'asc', includeTotalCount: true });

      expect(relayPaginationService.paginate).toHaveBeenCalledWith(
        noteModel,
        expect.objectContaining({
          args: { first: 10, after: 'cursor-abc', last: undefined, before: undefined },
          sort: [{ field: 'title', direction: 'ASC' }],
          includeTotalCount: true,
        }),
      );
    });

    it('rejects a sort field outside the whitelist', async () => {
      await expect(service.findAll({ sort: 'content' })).rejects.toBeInstanceOf(BadRequestException);
      expect(relayPaginationService.paginate).not.toHaveBeenCalled();
    });

    it('turns "search" into a $text filter', async () => {
      relayPaginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ search: 'groceries' });

      expect(relayPaginationService.paginate).toHaveBeenCalledWith(
        noteModel,
        expect.objectContaining({ filter: { archived: false, $text: { $search: 'groceries' } } }),
      );
    });

    it('merges whitelisted "filters" into the query filter', async () => {
      relayPaginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ filters: { tags: 'work' } });

      expect(relayPaginationService.paginate).toHaveBeenCalledWith(
        noteModel,
        expect.objectContaining({ filter: { archived: false, tags: 'work' } }),
      );
    });

    it('rejects a filter key outside the whitelist', async () => {
      await expect(service.findAll({ filters: { notAField: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
      expect(relayPaginationService.paginate).not.toHaveBeenCalled();
    });

    it('rejects a filter value that is a nested object (a potential Mongo operator injection)', async () => {
      await expect(service.findAll({ filters: { title: { $ne: null } } })).rejects.toBeInstanceOf(BadRequestException);
      expect(relayPaginationService.paginate).not.toHaveBeenCalled();
    });
  });

  describe("findAllCursor (v2, pagination-cursor's own engine)", () => {
    it('runs on the cursor engine, not the relay one, with the same option-shaping as findAll', async () => {
      const page = { rows: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
      cursorPaginationService.paginate.mockResolvedValue(page);

      const result = await service.findAllCursor({});

      expect(cursorPaginationService.paginate).toHaveBeenCalledWith(noteModel, {
        args: { first: undefined, after: undefined, last: undefined, before: undefined },
        sort: [{ field: 'createdAt', direction: 'DESC' }],
        filter: { archived: false },
        includeTotalCount: false,
      });
      expect(relayPaginationService.paginate).not.toHaveBeenCalled();
      expect(result).toBe(page);
    });

    it('rejects a sort field outside the whitelist, same as findAll', async () => {
      await expect(service.findAllCursor({ sort: 'content' })).rejects.toBeInstanceOf(BadRequestException);
      expect(cursorPaginationService.paginate).not.toHaveBeenCalled();
    });

    it('rejects a filter key outside the whitelist, same as findAll', async () => {
      await expect(service.findAllCursor({ filters: { notAField: 'x' } })).rejects.toBeInstanceOf(BadRequestException);
      expect(cursorPaginationService.paginate).not.toHaveBeenCalled();
    });
  });

  describe('findAllOffset', () => {
    it('defaults to sorting by createdAt DESC and excluding archived notes', async () => {
      const page = {
        data: [],
        meta: { page: 1, limit: 20, count: 0, totalItems: 0, totalPages: 0, hasPreviousPage: false, hasNextPage: false },
      };
      offsetPaginationService.paginate.mockResolvedValue(page);

      const result = await service.findAllOffset({ page: 1, limit: 20 });

      expect(offsetPaginationService.paginate).toHaveBeenCalledWith(noteModel, {
        args: { page: 1, limit: 20 },
        sort: [{ field: 'createdAt', direction: 'DESC' }],
        filter: { archived: false },
      });
      expect(result).toBe(page);
    });

    it('shares the same sort/filter/search/filters logic as the cursor path', async () => {
      offsetPaginationService.paginate.mockResolvedValue({ data: [], meta: {} });

      await service.findAllOffset({ page: 2, limit: 10, sort: 'title', order: 'asc', search: 'foo', filters: { archived: true } });

      expect(offsetPaginationService.paginate).toHaveBeenCalledWith(noteModel, {
        args: { page: 2, limit: 10 },
        sort: [{ field: 'title', direction: 'ASC' }],
        filter: { archived: true, $text: { $search: 'foo' } },
      });
    });

    it('rejects a sort field outside the whitelist, same as the cursor path', async () => {
      await expect(service.findAllOffset({ page: 1, limit: 20, sort: 'content' })).rejects.toBeInstanceOf(BadRequestException);
      expect(offsetPaginationService.paginate).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns the note when found', async () => {
      const id = validId();
      const note = { _id: id, title: 'Found' };
      noteModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(note) });

      const result = await service.findOne(id);

      expect(noteModel.findById).toHaveBeenCalledWith(id);
      expect(result).toBe(note);
    });

    it('throws NotFoundException when no note matches the id', async () => {
      const id = validId();
      noteModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.findOne(id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for a malformed id, before ever touching the model', async () => {
      await expect(service.findOne('not-an-object-id')).rejects.toBeInstanceOf(BadRequestException);
      expect(noteModel.findById).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates and returns the note, requesting the post-update document', async () => {
      const id = validId();
      const dto = { title: 'Updated title' };
      const updated = { _id: id, ...dto };
      noteModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) });

      const result = await service.update(id, dto);

      expect(noteModel.findByIdAndUpdate).toHaveBeenCalledWith(id, dto, { new: true });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the id does not exist', async () => {
      const id = validId();
      noteModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.update(id, { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for a malformed id', async () => {
      await expect(service.update('bad-id', { title: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(noteModel.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the note when it exists', async () => {
      const id = validId();
      noteModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({ _id: id }) });

      await expect(service.remove(id)).resolves.toBeUndefined();
      expect(noteModel.findByIdAndDelete).toHaveBeenCalledWith(id);
    });

    it('throws NotFoundException when the id does not exist', async () => {
      const id = validId();
      noteModel.findByIdAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });

      await expect(service.remove(id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException for a malformed id', async () => {
      await expect(service.remove('bad-id')).rejects.toBeInstanceOf(BadRequestException);
      expect(noteModel.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
