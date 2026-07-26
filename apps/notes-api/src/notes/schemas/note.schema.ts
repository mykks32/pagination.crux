/**
 * Mongoose schema/document for a single note.
 *
 * `@Schema({ timestamps: true })` gives every note a `createdAt`/`updatedAt`
 * pair maintained automatically by Mongoose — these double as the default
 * sort/cursor fields for pagination, since they're monotonic and indexed.
 */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

/** A note document as stored in MongoDB. */
@Schema({ timestamps: true })
export class Note {
  /** Short title, required so every note is identifiable in a list view. */
  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  /** Free-form body text. Optional — a note can be title-only. */
  @Prop({ trim: true, default: '' })
  content: string;

  /** Free-form labels used to filter/organize notes. */
  @Prop({ type: [String], default: [] })
  tags: string[];

  /** Soft "trash" flag — archived notes are excluded from the default list view but not deleted. */
  @Prop({ default: false })
  archived: boolean;

  /** Set automatically by `timestamps: true`; used as the default pagination sort key. */
  createdAt: Date;

  /** Set automatically by `timestamps: true`. */
  updatedAt: Date;
}

/** Hydrated Mongoose document type for `Note` (adds `_id`, `.save()`, etc). */
export type NoteDocument = HydratedDocument<Note>;

/**
 * Compiled schema, registered with `MongooseModule.forFeature([...])` in
 * `NotesModule`.
 *
 * The compound index on `(createdAt, _id)` matches the default cursor
 * pagination sort exactly (`createdAt` DESC + the automatic `_id`
 * tiebreaker) — without it, every list query would fall back to a
 * collection scan once the notes collection grows.
 */
export const NoteSchema = SchemaFactory.createForClass(Note);
NoteSchema.index({ createdAt: -1, _id: -1 });
