/**
 * REST envelope every cursor-paginated list endpoint returns — a flat
 * `data` array (no Relay-style edges/node wrapping) plus `meta` and
 * `links`. This is the shape exposed to API consumers; internally the
 * paginator still works in Relay terms (`@mykks32/pagination-relay`'s
 * `PaginatedResult`), reshaped into this envelope by this package.
 *
 * `data`'s type `T` is generic and left un-`@Type()`-annotated on purpose:
 * class-transformer only needs `@Type()` to know what class to *construct*
 * during a plain→class pass, and this class is only ever built directly
 * (via `toPaginatedResponse()`) and serialized class→plain — each item in
 * `data` already carries its own type/decorators at that point.
 */
import { Exclude, Expose, Type } from 'class-transformer';
import { PaginatedLinksSerializer } from './paginated-links.serializer';
import { PaginatedMetaSerializer } from './paginated-meta.serializer';

@Exclude()
export class PaginatedResponseSerializer<T> {
  // Definite-assignment assertions: always set via Object.assign in
  // toPaginatedResponse(), never through this class's own constructor.
  @Expose()
  data!: T[];

  @Expose()
  @Type(() => PaginatedMetaSerializer)
  meta!: PaginatedMetaSerializer;

  @Expose()
  @Type(() => PaginatedLinksSerializer)
  links!: PaginatedLinksSerializer;
}
