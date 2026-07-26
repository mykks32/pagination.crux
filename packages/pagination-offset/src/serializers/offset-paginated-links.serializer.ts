import { Exclude, Expose } from 'class-transformer';

@Exclude()
export class OffsetPaginatedLinksSerializer {
  // Definite-assignment assertions: always set via Object.assign in
  // buildOffsetLinks(), never through this class's own constructor.
  @Expose()
  self!: string;

  @Expose()
  first!: string;

  /** `null` when already on the first page. */
  @Expose()
  previous!: string | null;

  /** `null` when already on the last page. */
  @Expose()
  next!: string | null;

  @Expose()
  last!: string;
}
