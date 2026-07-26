/** Request body shape for `PATCH /v1/notes/:id`. */
import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateNoteDto } from './create-note.dto';

/**
 * Every field from {@link CreateNoteDto}, made optional (`PartialType`), plus
 * `archived` — updates are partial by nature (PATCH semantics), so callers
 * only send the fields they want to change.
 */
export class UpdateNoteDto extends PartialType(CreateNoteDto) {
  /** Toggle a note's archived state without needing a separate endpoint. */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
