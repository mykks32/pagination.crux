/**
 * Generic, resource-agnostic cursor pagination query shape — the REST
 * query-string counterpart to `@mykks32/pagination`'s `CursorPaginationArgs`,
 * extended with the query-string conventions most list endpoints need
 * (search, sort, sparse fieldsets, ad-hoc filters). Resource-specific query
 * DTOs (e.g. an app's `ListUsersQueryDto`) extend this rather than
 * repeating it.
 */
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

/** Parses a comma-separated query value (`?include=title,content`) into a string array. */
function toStringArray({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Parses a JSON-encoded `filters` query value; malformed JSON is left as-is for `@IsObject` to reject. */
function toObject({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class CursorPaginationDto {
  /** Page size when paging forward. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  first?: number;

  /** Page size when paging backward. */
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  last?: number;

  /** Cursor to seek past when paging forward — copied verbatim from a previous response's `meta.endCursor`. */
  @IsOptional()
  @IsString()
  after?: string;

  /** Cursor to seek past when paging backward — copied verbatim from a previous response's `meta.startCursor`. */
  @IsOptional()
  @IsString()
  before?: string;

  /** Free-text search term. Resource DTOs decide which fields it searches. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Field to sort by. Resource DTOs whitelist which field names are valid. */
  @IsOptional()
  @IsString()
  sort?: string;

  /** Sort direction, lowercase (REST convention) — mapped to the library's `ASC`/`DESC` at the service boundary. */
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  /** Sparse fieldset: only these fields are included in each returned item. Takes precedence over `exclude` if both are given. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  include?: string[];

  /** Sparse fieldset: these fields are dropped from each returned item. Ignored if `include` is also given. */
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @IsString({ each: true })
  exclude?: string[];

  /**
   * Ad-hoc equality filters, JSON-encoded (`?filters={"tags":"work"}`).
   * Resource services must sanitize this against a field whitelist before
   * merging it into a database query — never pass it straight through, or
   * unknown/operator keys become a NoSQL injection vector.
   */
  @IsOptional()
  @Transform(toObject)
  @IsObject()
  filters?: Record<string, unknown>;
}
