/**
 * Business logic for notes: plain CRUD plus cursor-paginated listing.
 *
 * Listing is the interesting part — everything else is a thin Mongoose
 * wrapper. See {@link NotesService.findAll} for how this plugs into
 * `MongoCursorPaginationService`.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
// MongoCursorPaginationService must be a real (non-type-only) import: it's
// used as an implicit constructor injection token below (no explicit
// @Inject), so Nest needs the actual class reference at runtime via
// reflect-metadata's emitted `design:paramtypes` — a type-only import would
// erase it entirely and break DI resolution. eslint's consistent-type-imports
// can't tell the difference from a genuinely type-only usage, hence the disable.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MongoCursorPaginationService, type PaginatedResult } from '@mykks32/pagination';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { CreateNoteDto } from './dto/create-note.dto';
import type { ListNotesQueryDto } from './dto/list-notes-query.dto';
import type { UpdateNoteDto } from './dto/update-note.dto';
import { Note, type NoteDocument } from './schemas/note.schema';

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<Note>,
    private readonly paginationService: MongoCursorPaginationService,
  ) {}

  /** Creates a new note and returns the persisted document (with its generated `_id`/`createdAt`/`updatedAt`). */
  async create(dto: CreateNoteDto): Promise<NoteDocument> {
    return this.noteModel.create(dto);
  }

  /**
   * Cursor-paginates the notes collection.
   *
   * Delegates the actual seek-filter/limit/cursor-encoding work to
   * `MongoCursorPaginationService.paginate()` — this method's only job is
   * translating note-specific query params (archived filter, sort field
   * whitelist) into the library's generic options shape.
   *
   * Return type is `PaginatedResult<Note>` rather than `<NoteDocument>`:
   * `paginate<T>()` infers `T` from `Model<Note>`, so its *static* return
   * type is `Note`-shaped even though each `edge.node` is a real hydrated
   * document at runtime. Callers that need Document methods (as
   * `NotesController` does, to build `NoteResponseDto`) cast accordingly.
   */
  async findAll(query: ListNotesQueryDto): Promise<PaginatedResult<Note>> {
    const {
      first,
      after,
      last,
      before,
      sortBy = 'createdAt',
      sortDirection = 'DESC',
      includeArchived = false,
      includeTotalCount = false,
    } = query;

    return this.paginationService.paginate(this.noteModel, {
      args: { first, after, last, before },
      // _id is appended automatically by the library as a tiebreaker, so a
      // single-field sort here still yields a stable, gap-free keyset.
      sort: [{ field: sortBy, direction: sortDirection }],
      // Archived notes are hidden by default — a soft-delete-style filter
      // that composes with the cursor's own seek filter via $and.
      filter: includeArchived ? {} : { archived: false },
      includeTotalCount,
    });
  }

  /** Fetches a single note by id, or throws `NotFoundException` if it doesn't exist. */
  async findOne(id: string): Promise<NoteDocument> {
    this.assertValidObjectId(id);
    const note = await this.noteModel.findById(id).exec();
    if (!note) {
      throw new NotFoundException(`Note "${id}" not found.`);
    }
    return note;
  }

  /** Applies a partial update to a note and returns the updated document. Throws `NotFoundException` if the id doesn't exist. */
  async update(id: string, dto: UpdateNoteDto): Promise<NoteDocument> {
    this.assertValidObjectId(id);
    // { new: true } returns the post-update document instead of the
    // pre-update one, which is what callers of an update endpoint expect.
    const note = await this.noteModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!note) {
      throw new NotFoundException(`Note "${id}" not found.`);
    }
    return note;
  }

  /** Permanently deletes a note. Throws `NotFoundException` if the id doesn't exist. */
  async remove(id: string): Promise<void> {
    this.assertValidObjectId(id);
    const result = await this.noteModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Note "${id}" not found.`);
    }
  }

  /** Rejects malformed ids with a 400 before they reach a Mongoose query (which would otherwise throw a less friendly `CastError`). */
  private assertValidObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`"${id}" is not a valid note id.`);
    }
  }
}
