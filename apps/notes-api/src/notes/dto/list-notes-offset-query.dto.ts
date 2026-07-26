/**
 * Query-string shape for `GET /v3/notes` (offset/page pagination): the
 * generic `OffsetPaginationDto` plus the same note-specific extra
 * (`includeArchived`) `ListNotesQueryDto` adds for the cursor variants.
 * `sort`/`filters` whitelist validation happens in `NotesService`, shared
 * with the cursor query path — see `NOTE_SORTABLE_FIELDS`/`NOTE_FILTERABLE_FIELDS`
 * in `list-notes-query.dto.ts`.
 */
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { OffsetPaginationDto } from '@mykks32/pagination-offset';

/** Parses a query-string boolean (`"true"`/`"false"`) into an actual boolean; anything else is left for `@IsBoolean` to reject. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListNotesOffsetQueryDto extends OffsetPaginationDto {
  /** When true, includes archived notes in the result; excluded by default. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;
}
