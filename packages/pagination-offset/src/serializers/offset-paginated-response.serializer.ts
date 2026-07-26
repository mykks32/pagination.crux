/**
 * REST envelope every offset-paginated list endpoint returns.
 *
 * `data`'s type `T` is generic and left un-`@Type()`-annotated on purpose:
 * class-transformer only needs `@Type()` to know what class to *construct*
 * during a plain→class pass, and this class is only ever built directly
 * (via `toOffsetPaginatedResponse()`) and serialized class→plain — each
 * item in `data` already carries its own type/decorators at that point.
 */
import { Exclude, Expose, Type } from 'class-transformer';
import { OffsetPaginatedLinksSerializer } from './offset-paginated-links.serializer';
import { OffsetPageMetaSerializer } from './offset-page-meta.serializer';

@Exclude()
export class OffsetPaginatedResponseSerializer<T> {
  // Definite-assignment assertions: always set via Object.assign in
  // toOffsetPaginatedResponse(), never through this class's own constructor.
  @Expose()
  data!: T[];

  @Expose()
  @Type(() => OffsetPageMetaSerializer)
  meta!: OffsetPageMetaSerializer;

  @Expose()
  @Type(() => OffsetPaginatedLinksSerializer)
  links!: OffsetPaginatedLinksSerializer;
}
