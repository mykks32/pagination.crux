import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class PaginatedLinksSerializer {
  // Definite-assignment assertions: always set via Object.assign in
  // buildPaginatedLinks(), never through this class's own constructor.
  /** The request that produced this exact response. */
  @Expose()
  self!: string;

  /** Link to the previous page, or `null` if there isn't one. */
  @Expose()
  previous!: string | null;

  /** Link to the next page, or `null` if there isn't one. */
  @Expose()
  next!: string | null;
}
