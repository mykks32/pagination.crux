/** Public, framework/ODM-agnostic contracts for offset (page/limit) pagination. */

/** Ascending or descending order for a single sort field. */
export type SortDirection = 'ASC' | 'DESC';

/** One field in a (possibly compound) sort order. */
export interface SortField {
  readonly field: string;
  readonly direction: SortDirection;
}

/** `page`/`limit` arguments — 1-indexed pages, unlike cursor pagination there is no forward/backward direction to choose. */
export interface OffsetPaginationArgs {
  readonly page?: number;
  readonly limit?: number;
}

// The REST-facing output shapes (page meta, links, envelope) live in
// `../serializers/` as class-transformer-decorated classes, not interfaces
// here — they're built directly by `toOffsetPaginatedResponse()` and
// serialized by the consuming app's `ClassSerializerInterceptor`, so they
// need real runtime `@Expose()` metadata, not just a compile-time shape.
