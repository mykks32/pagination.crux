/** Wires together the Note Mongoose model, the cursor pagination service, and the Notes controller/service. */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoCursorPaginationService } from '@mykks32/pagination';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { Note, NoteSchema } from './schemas/note.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }])],
  controllers: [NotesController],
  // MongoCursorPaginationService is registered here (rather than only in a
  // shared/global module) since NotesService is currently its only
  // consumer; add it to a shared module if a second feature module needs it.
  providers: [NotesService, MongoCursorPaginationService],
})
export class NotesModule {}
