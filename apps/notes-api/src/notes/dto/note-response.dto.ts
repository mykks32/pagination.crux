/**
 * Response shape for a single note — the serialization boundary between the
 * Mongoose document (persistence model) and what the HTTP API exposes.
 *
 * `@Exclude()` at the class level makes every field opt-in via `@Expose()`,
 * so anything on the underlying document that isn't explicitly listed here
 * (Mongoose's `__v`, the raw `_id` ObjectId, etc.) never reaches a client.
 * Paired with the global `ClassSerializerInterceptor` (registered in
 * `main.ts`), this is NestJS's standard serialization mechanism.
 */
import { Exclude, Expose } from 'class-transformer';
import type { NoteDocument } from '../schemas/note.schema';

@Exclude()
export class NoteResponseDto {
  @Expose()
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

  constructor(partial: NoteResponseDto) {
    Object.assign(this, partial);
  }

  /** Maps one hydrated Mongoose document into its public response shape (`_id` -> `id`, drops everything else Mongoose-internal). */
  static fromDocument(doc: NoteDocument): NoteResponseDto {
    return new NoteResponseDto({
      id: doc._id.toString(),
      title: doc.title,
      content: doc.content,
      tags: doc.tags,
      archived: doc.archived,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }

  /** Convenience batch form of {@link fromDocument}, used when mapping a page of results. */
  static fromDocuments(docs: NoteDocument[]): NoteResponseDto[] {
    return docs.map((doc) => NoteResponseDto.fromDocument(doc));
  }
}
