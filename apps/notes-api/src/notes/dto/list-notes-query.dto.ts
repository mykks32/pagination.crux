/**
 * Query-string shape for `GET /v1/notes`.
 *
 * This is the full Relay-style cursor pagination surface from `pagination`
 * (`first`/`after`/`last`/`before`) exposed over HTTP, plus note-specific
 * filtering/sorting. `class-transformer` converts query-string values
 * (always strings) into the numbers/booleans the pagination library and
 * Mongoose expect; `class-validator` then rejects anything malformed before
 * it reaches the database layer.
 */
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** Fields notes can be sorted by. Whitelisted (rather than accepting any string) so every option maps to an indexed field. */
export const NOTE_SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title'] as const;
export type NoteSortableField = (typeof NOTE_SORTABLE_FIELDS)[number];

/** Parses a query-string boolean (`"true"`/`"false"`) into an actual boolean; anything else is left for `@IsBoolean` to reject. */
function toBoolean({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

export class ListNotesQueryDto {
  /** Page size when paging forward. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  /** Cursor to seek past when paging forward — opaque, copied verbatim from a previous response's `pageInfo.endCursor`. */
  @IsOptional()
  @IsString()
  after?: string;

  /** Page size when paging backward. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  last?: number;

  /** Cursor to seek past when paging backward — from a previous response's `pageInfo.startCursor`. */
  @IsOptional()
  @IsString()
  before?: string;

  /** Field to sort by. Defaults to `createdAt` in the service if omitted. */
  @IsOptional()
  @IsIn(NOTE_SORTABLE_FIELDS)
  sortBy?: NoteSortableField;

  /** Sort direction. Defaults to `DESC` (newest first) in the service if omitted. */
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDirection?: 'ASC' | 'DESC';

  /** When true, includes archived notes in the result; excluded by default. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeArchived?: boolean;

  /** When true, also runs an extra `countDocuments` and returns `totalCount` — opt-in since it's an additional query. */
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeTotalCount?: boolean;
}
