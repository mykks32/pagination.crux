/**
 * Output-only shape — pairs with the global `ClassSerializerInterceptor`
 * in a consuming Nest app. `@Exclude()` at the class level makes every
 * field opt-in via `@Expose()`, same convention as any other response DTO
 * in this monorepo.
 */
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class OffsetPageMetaSerializer {
  // Definite-assignment assertions: always set via Object.assign in
  // mongo-offset-paginator.ts's paginate(), never through a constructor.
  @Expose()
  page!: number;

  @Expose()
  limit!: number;

  /** Items actually present in this page's `data` (== `limit` for every page except possibly the last). */
  @Expose()
  count!: number;

  /** Total items matching the query, across all pages. */
  @Expose()
  totalItems!: number;

  @Expose()
  totalPages!: number;

  @Expose()
  hasPreviousPage!: boolean;

  @Expose()
  hasNextPage!: boolean;
}
