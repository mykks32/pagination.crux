/**
 * Business logic for notes: plain CRUD plus listing, in three genuinely
 * independent pagination flavors — {@link NotesService.findAll} (v1, Relay
 * connections via `@mykks32/pagination-relay`'s Mongo engine),
 * {@link NotesService.findAllCursor} (v2, flat REST cursor pagination via
 * `@mykks32/pagination-cursor`'s *own* Mongo engine — a separate keyset
 * paginator, not a reshape of v1's result), and
 * {@link NotesService.findAllOffset} (v3, page/limit via
 * `@mykks32/pagination-offset`). All three share the same
 * sort-whitelist/filter-sanitization/search logic
 * ({@link NotesService.resolveSort}/{@link NotesService.buildFilter}), which
 * delegates to `@mykks32/pagination-cursor`'s `resolveSort`/`sanitizeFilters`
 * utilities — only the pagination mechanics differ, which is what's
 * delegated out to each package's own Mongo paginator/service.
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
// Both packages export a class named MongoCursorPaginationService — aliased so v1 (relay) and v2 (cursor) inject distinct, unrelated engines.
import { MongoCursorPaginationService as RelayMongoCursorPaginationService, type PaginatedResult } from '@mykks32/pagination-relay';
import {
  MongoCursorPaginationService as CursorMongoCursorPaginationService,
  resolveSort,
  sanitizeFilters,
  type CursorPage,
} from '@mykks32/pagination-cursor';
import { MongoOffsetPaginationService, type OffsetPage } from '@mykks32/pagination-offset';
import type { FilterQuery, Model } from 'mongoose';
import { Types } from 'mongoose';
import type { CreateNoteDto } from '../dto/create-note.dto';
import type { ListNotesOffsetQueryDto } from '../dto/list-notes-offset-query.dto';
import type { ListNotesQueryDto } from '../dto/list-notes-query.dto';
import { NOTE_FILTERABLE_FIELDS, NOTE_SORTABLE_FIELDS, type NoteSortableField } from '../dto/list-notes-query.dto';
import type { UpdateNoteDto } from '../dto/update-note.dto';
import { Note, type NoteDocument } from '../schemas/note.schema';

const DEFAULT_SORT_FIELD: NoteSortableField = 'createdAt';

/** The subset of list-query fields shared between the cursor and offset query DTOs — enough for `resolveSort`/`buildFilter` to work with either. */
interface CommonListParams {
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, unknown>;
}

@Injectable()
export class NotesService {
  constructor(
    @InjectModel(Note.name) private readonly noteModel: Model<Note>,
    private readonly relayPaginationService: RelayMongoCursorPaginationService,
    private readonly cursorPaginationService: CursorMongoCursorPaginationService,
    private readonly offsetPaginationService: MongoOffsetPaginationService,
  ) {}

  /** Creates a new note and returns the persisted document (with its generated `_id`/`createdAt`/`updatedAt`). */
  async create(dto: CreateNoteDto): Promise<NoteDocument> {
    return this.noteModel.create(dto);
  }

  /**
   * Cursor-paginates the notes collection, Relay connection style — the v1
   * listing style. Delegates the actual seek-filter/limit/cursor-encoding
   * work to `@mykks32/pagination-relay`'s `MongoCursorPaginationService` —
   * this method's only job is translating note-specific query params
   * (archived filter, sort field whitelist) into the library's generic
   * options shape.
   *
   * Return type is `PaginatedResult<Note>` rather than `<NoteDocument>`:
   * `paginate<T>()` infers `T` from `Model<Note>`, so its *static* return
   * type is `Note`-shaped even though each `edge.node` is a real hydrated
   * document at runtime. Callers that need Document methods (as
   * `NotesController` does, to build `NoteSerializer`) cast accordingly.
   */
  async findAll(query: ListNotesQueryDto): Promise<PaginatedResult<Note>> {
    const { first, after, last, before, includeArchived = false, includeTotalCount = false } = query;

    return this.relayPaginationService.paginate(this.noteModel, {
      args: { first, after, last, before },
      // _id is appended automatically by the library as a tiebreaker, so a
      // single-field sort here still yields a stable, gap-free keyset.
      sort: [this.resolveSort(query)],
      filter: this.buildFilter(query, includeArchived),
      includeTotalCount,
    });
  }

  /**
   * Cursor-paginates the notes collection, flat REST envelope style — the
   * v2 listing style. Runs on `@mykks32/pagination-cursor`'s *own* Mongo
   * cursor engine, a separate keyset paginator from v1's — not a reshape
   * of {@link findAll}'s result. Same query params and pagination
   * semantics as v1, entirely independent implementation underneath.
   */
  async findAllCursor(query: ListNotesQueryDto): Promise<CursorPage<Note>> {
    const { first, after, last, before, includeArchived = false, includeTotalCount = false } = query;

    return this.cursorPaginationService.paginate(this.noteModel, {
      args: { first, after, last, before },
      sort: [this.resolveSort(query)],
      filter: this.buildFilter(query, includeArchived),
      includeTotalCount,
    });
  }

  /**
   * Offset (page/limit)-paginates the notes collection — the v3 listing
   * style. Shares `resolveSort`/`buildFilter` with {@link findAll}; only
   * the pagination mechanics (skip/limit + countDocuments, always, vs.
   * seek filter + opt-in count) differ, which is what
   * `MongoOffsetPaginationService` handles.
   */
  async findAllOffset(query: ListNotesOffsetQueryDto): Promise<OffsetPage<Note>> {
    const { page, limit, includeArchived = false } = query;

    return this.offsetPaginationService.paginate(this.noteModel, {
      args: { page, limit },
      sort: [this.resolveSort(query)],
      filter: this.buildFilter(query, includeArchived),
    });
  }

  /** Validates `sort`/`order` against the notes whitelist, defaulting to `createdAt DESC` if omitted. Shared by both listing methods; delegates to `@mykks32/pagination-cursor`'s `resolveSort()`. */
  private resolveSort(query: CommonListParams) {
    return resolveSort(query, NOTE_SORTABLE_FIELDS, DEFAULT_SORT_FIELD);
  }

  /**
   * Combines the archived visibility rule, free-text search, and sanitized
   * ad-hoc filters into a single Mongo filter. Shared by both listing
   * methods; `findAll` additionally merges this with the cursor's own seek
   * filter (via $and) inside `paginate()`.
   */
  private buildFilter(query: CommonListParams, includeArchived: boolean): FilterQuery<Note> {
    const filter: FilterQuery<Note> = includeArchived ? {} : { archived: false };

    if (query.search) {
      filter.$text = { $search: query.search };
    }

    Object.assign(filter, sanitizeFilters(query.filters, NOTE_FILTERABLE_FIELDS));
    return filter;
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
