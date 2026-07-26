/**
 * Output-only shape — pairs with the global `ClassSerializerInterceptor`
 * in a consuming Nest app. `@Exclude()` at the class level makes every
 * field opt-in via `@Expose()`, same convention as any other response DTO
 * in this monorepo.
 */
import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaginatedMetaSerializer {
  /** Total items matching the query, across all pages. */
  @Expose()
  count?: number;

  // Definite-assignment assertions: always set via Object.assign by
  // toPaginatedResponse()/buildPaginatedLinks(), never through a constructor.
  @Expose()
  hasNextPage!: boolean;

  @Expose()
  hasPreviousPage!: boolean;

  @Expose()
  startCursor!: string | null;

  @Expose()
  endCursor!: string | null;
}
