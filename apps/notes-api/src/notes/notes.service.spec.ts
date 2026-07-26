/**
 * Unit tests for NotesService. The Mongoose model and MongoCursorPaginationService
 * are both provided as jest mocks — this suite is about NotesService's own
 * logic (id validation, not-found handling, how it shapes pagination
 * options), not about Mongoose or the pagination library themselves (those
 * are covered by @mykks32/pagination's own test suite).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoCursorPaginationService } from '@mykks32/pagination';
import { Types } from 'mongoose';
import { NotesService } from './notes.service';
import { Note } from './schemas/note.schema';

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
  let paginationService: { paginate: jest.Mock };

  /** A syntactically valid ObjectId string — distinct per test run so tests can't accidentally rely on id equality. */
  const validId = () => new Types.ObjectId().toHexString();

  beforeEach(async () => {
    noteModel = {
      create: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };
    paginationService = { paginate: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotesService,
        { provide: getModelToken(Note.name), useValue: noteModel },
        // MongoCursorPaginationService is injected by class reference, not
        // a string token, so the mock has to be provided under that same class.
        { provide: MongoCursorPaginationService, useValue: paginationService },
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

  describe('findAll', () => {
    it('defaults to sorting by createdAt DESC and excluding archived notes', async () => {
      const page = { edges: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null } };
      paginationService.paginate.mockResolvedValue(page);

      const result = await service.findAll({});

      expect(paginationService.paginate).toHaveBeenCalledWith(noteModel, {
        args: { first: undefined, after: undefined, last: undefined, before: undefined },
        sort: [{ field: 'createdAt', direction: 'DESC' }],
        filter: { archived: false },
        includeTotalCount: false,
      });
      expect(result).toBe(page);
    });

    it('drops the archived filter when includeArchived is true', async () => {
      paginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ includeArchived: true });

      expect(paginationService.paginate).toHaveBeenCalledWith(noteModel, expect.objectContaining({ filter: {} }));
    });

    it('forwards a custom sortBy/sortDirection and the first/after cursor args untouched', async () => {
      paginationService.paginate.mockResolvedValue({ edges: [], pageInfo: {} });

      await service.findAll({ first: 10, after: 'cursor-abc', sortBy: 'title', sortDirection: 'ASC', includeTotalCount: true });

      expect(paginationService.paginate).toHaveBeenCalledWith(
        noteModel,
        expect.objectContaining({
          args: { first: 10, after: 'cursor-abc', last: undefined, before: undefined },
          sort: [{ field: 'title', direction: 'ASC' }],
          includeTotalCount: true,
        }),
      );
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
