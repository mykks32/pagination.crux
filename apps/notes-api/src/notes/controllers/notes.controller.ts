/**
 * REST surface for notes (URI versioning enabled globally in `main.ts`).
 * Thin HTTP layer only — all logic lives in `NotesService`.
 *
 * Three listing styles live side by side to demonstrate all three
 * pagination packages in this monorepo, each running its own independent
 * Mongo engine (v1 and v2 do NOT share a paginator call):
 *   - v1: `findAll`       — Relay-style `{ edges, pageInfo }`, via `@mykks32/pagination-relay`'s own Mongo engine
 *   - v2: `findAllCursor`  — flat REST cursor pagination `{ data, meta, links }`, via `@mykks32/pagination-cursor`'s own Mongo engine
 *   - v3: `findAllOffset`  — classic page/limit pagination `{ data, meta, links }` (`@mykks32/pagination-offset`)
 *
 * Create/read-one/update/delete don't vary by pagination style, so they're
 * defined once and tagged `@Version(['1', '2', '3'])` rather than
 * duplicated across three controllers.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Version } from '@nestjs/common';
import type { Edge, PaginatedResult } from '@mykks32/pagination-relay';
import { applyFieldSelection, toPaginatedResponse } from '@mykks32/pagination-cursor';
import type { PaginatedResponseSerializer } from '@mykks32/pagination-cursor';
import { toOffsetPaginatedResponse } from '@mykks32/pagination-offset';
import type { OffsetPaginatedResponseSerializer } from '@mykks32/pagination-offset';
import { response } from '../../common/serializers/response.serializer';
import { CreateNoteDto } from '../dto/create-note.dto';
import { ListNotesOffsetQueryDto } from '../dto/list-notes-offset-query.dto';
import { ListNotesQueryDto } from '../dto/list-notes-query.dto';
import { NoteSerializer } from '../serializers/note.serializer';
import { UpdateNoteDto } from '../dto/update-note.dto';
import { NotesService } from '../services/notes.service';
import type { NoteDocument } from '../schemas/note.schema';

const BASE_PATH_V2 = '/v2/notes';
const BASE_PATH_V3 = '/v3/notes';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** `POST /v{1,2,3}/notes` — create a note. Identical across every version. */
  @Post()
  @Version(['1', '2', '3'])
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateNoteDto): Promise<NoteSerializer> {
    const note = await this.notesService.create(dto);
    return response(NoteSerializer, note);
  }

  /**
   * `GET /v1/notes` — cursor-paginated list, Relay Cursor Connections shape.
   *
   * Forward: `?first=20` then `?first=20&after=<pageInfo.endCursor>`.
   * Backward: `?last=20&before=<pageInfo.startCursor>`.
   */
  @Get()
  @Version('1')
  async findAll(@Query() query: ListNotesQueryDto): Promise<PaginatedResult<NoteSerializer>> {
    const page = await this.notesService.findAll(query);
    const edges: Edge<NoteSerializer>[] = page.edges.map((edge) => ({
      cursor: edge.cursor,
      node: response(NoteSerializer, edge.node as NoteDocument),
    }));
    return { ...page, edges };
  }

  /**
   * `GET /v2/notes` — cursor-paginated list, flat REST envelope.
   *
   * Same query params and pagination semantics as v1's `findAll`, but runs
   * on `@mykks32/pagination-cursor`'s *own* Mongo cursor engine — a
   * separate keyset paginator, not a reshape of v1's result.
   */
  @Get()
  @Version('2')
  async findAllCursor(@Query() query: ListNotesQueryDto): Promise<PaginatedResponseSerializer<Partial<NoteSerializer>>> {
    const page = await this.notesService.findAllCursor(query);
    const data = page.rows.map((row) => {
      const node = response(NoteSerializer, row as NoteDocument);
      return applyFieldSelection(node, query.include, query.exclude);
    });
    return toPaginatedResponse(BASE_PATH_V2, query, page.pageInfo, data, page.totalCount);
  }

  /**
   * `GET /v3/notes` — classic page/limit ("offset") pagination.
   *
   * `?page=2&limit=20`; response always includes `meta.totalItems`/
   * `totalPages` and `links.first`/`last` for jump-to-any-page navigation
   * — the trade-off offset pagination makes for a `countDocuments` and a
   * `skip()` on every request, via `@mykks32/pagination-offset`.
   */
  @Get()
  @Version('3')
  async findAllOffset(@Query() query: ListNotesOffsetQueryDto): Promise<OffsetPaginatedResponseSerializer<Partial<NoteSerializer>>> {
    const page = await this.notesService.findAllOffset(query);
    const data = page.data.map((doc) => {
      const node = response(NoteSerializer, doc as NoteDocument);
      return applyFieldSelection(node, query.include, query.exclude);
    });
    return toOffsetPaginatedResponse(BASE_PATH_V3, query, { data, meta: page.meta });
  }

  /** `GET /v{1,2,3}/notes/:id` — fetch one note. Identical across every version. */
  @Get(':id')
  @Version(['1', '2', '3'])
  async findOne(@Param('id') id: string): Promise<NoteSerializer> {
    const note = await this.notesService.findOne(id);
    return response(NoteSerializer, note);
  }

  /** `PATCH /v{1,2,3}/notes/:id` — partially update a note (including toggling `archived`). Identical across every version. */
  @Patch(':id')
  @Version(['1', '2', '3'])
  async update(@Param('id') id: string, @Body() dto: UpdateNoteDto): Promise<NoteSerializer> {
    const note = await this.notesService.update(id, dto);
    return response(NoteSerializer, note);
  }

  /** `DELETE /v{1,2,3}/notes/:id` — permanently remove a note. Identical across every version. */
  @Delete(':id')
  @Version(['1', '2', '3'])
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.notesService.remove(id);
  }
}
