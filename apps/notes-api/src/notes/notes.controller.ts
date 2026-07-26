/**
 * REST surface for notes, mounted at `/v1/notes` (URI versioning is enabled
 * globally in `main.ts`). Thin HTTP layer only — all logic lives in
 * `NotesService`.
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import type { Edge, PaginatedResult } from '@mykks32/pagination';
// CreateNoteDto/ListNotesQueryDto/UpdateNoteDto/NotesService must stay real
// (non-type-only) imports even though eslint's consistent-type-imports rule
// below flags them as type-only-looking: each is either a @Body()/@Query()
// parameter type (Nest's ValidationPipe needs the actual class, via
// reflect-metadata, to transform/validate against) or an implicit
// constructor injection token (no explicit @Inject) — a type-only import
// erases the class and silently breaks both at runtime, not just in tests.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateNoteDto } from './dto/create-note.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ListNotesQueryDto } from './dto/list-notes-query.dto';
import { NoteResponseDto } from './dto/note-response.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UpdateNoteDto } from './dto/update-note.dto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { NotesService } from './notes.service';
import type { NoteDocument } from './schemas/note.schema';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /** `POST /v1/notes` — create a note. */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateNoteDto): Promise<NoteResponseDto> {
    const note = await this.notesService.create(dto);
    return NoteResponseDto.fromDocument(note);
  }

  /**
   * `GET /v1/notes` — cursor-paginated list.
   *
   * Forward: `?first=20` then `?first=20&after=<pageInfo.endCursor>`.
   * Backward: `?last=20&before=<pageInfo.startCursor>`.
   */
  @Get()
  async findAll(@Query() query: ListNotesQueryDto): Promise<PaginatedResult<NoteResponseDto>> {
    const page = await this.notesService.findAll(query);
    // Re-shape edges to carry NoteResponseDto nodes instead of raw Mongoose
    // documents; pageInfo/totalCount pass through untouched since they're
    // already plain, public-safe values.
    const edges: Edge<NoteResponseDto>[] = page.edges.map((edge) => ({
      cursor: edge.cursor,
      node: NoteResponseDto.fromDocument(edge.node as NoteDocument),
    }));
    return { ...page, edges };
  }

  /** `GET /v1/notes/:id` — fetch one note. */
  @Get(':id')
  async findOne(@Param('id') id: string): Promise<NoteResponseDto> {
    const note = await this.notesService.findOne(id);
    return NoteResponseDto.fromDocument(note);
  }

  /** `PATCH /v1/notes/:id` — partially update a note (including toggling `archived`). */
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateNoteDto): Promise<NoteResponseDto> {
    const note = await this.notesService.update(id, dto);
    return NoteResponseDto.fromDocument(note);
  }

  /** `DELETE /v1/notes/:id` — permanently remove a note. */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.notesService.remove(id);
  }
}
