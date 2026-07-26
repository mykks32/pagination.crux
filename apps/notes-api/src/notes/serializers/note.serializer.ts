/**
 * Response shape for a single note — the serialization boundary between the
 * Mongoose document (persistence model) and what the HTTP API exposes.
 *
 * `@Exclude()` at the class level makes every field opt-in via `@Expose()`,
 * so anything on the underlying document that isn't explicitly listed here
 * (Mongoose's `__v`, the raw `_id` ObjectId, etc.) never reaches a client.
 * Built via the generic `response()` serializer (`common/serializers/`),
 * not a hand-rolled `fromDocument` factory — one fewer per-class mapping
 * function to keep in sync with the schema.
 */
import { Exclude, Expose, Transform } from 'class-transformer';

@Exclude()
export class NoteSerializer {
  /**
   * Derived from the source document's `_id` (an ObjectId, not a string) via
   * `@Transform` — there's no `id` key on the source to `@Expose()`
   * directly. Falls back to `obj.id` because this class gets serialized
   * twice: once explicitly via `response()` (source is the raw document,
   * has `_id`), and again automatically by the global
   * `ClassSerializerInterceptor` (source is now this already-built
   * instance, has `id` but no `_id`).
   */
  @Expose()
  @Transform(({ obj }: { obj: { _id?: { toString(): string }; id?: string } }) => obj._id?.toString() ?? obj.id)
  id: string;

  @Expose()
  title: string;

  @Expose()
  content: string;

  @Expose()
  tags: string[];

  @Expose()
  archived: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
