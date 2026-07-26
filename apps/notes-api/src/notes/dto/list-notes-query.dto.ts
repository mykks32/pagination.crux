/**
 * Query-string shape for `GET /v1/notes`: the generic `CursorPaginationDto`
 * plus the one note-specific extra (`includeArchived`). Whether `sort`'s
 * value and `filters`' keys are actually valid for notes is checked in
 * `NotesService`, not here — the DTO only knows generic shape/type, not
 * which fields the Note schema actually has.
 */
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorPaginationDto } from '@mykks32/pagination-cursor';

/** Fields notes can be sorted or filtered by. Whitelisted so every option maps to an indexed field / can't smuggle a Mongo operator. */
export const NOTE_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export type NoteSortableField = (typeof NOTE_SORTABLE_FIELDS)[number];

export const NOTE_FILTERABLE_FIELDS = ['title', 'tags', 'archived'] as const;

/** Parses a query-string boolean (`"true"`/`"false"`) into an actual boolean; anything else is left for `@IsBoolean` to reject. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListNotesQueryDto extends CursorPaginationDto {
  /** When true, includes archived notes in the result; excluded by default. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;

  /** When true, also runs an extra `countDocuments` and populates `meta.count` — opt-in since it's an additional query. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeTotalCount?: boolean;
}
