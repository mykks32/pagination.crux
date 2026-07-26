/** Wires together the Note Mongoose model, both pagination services, and the Notes controller/service. */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoCursorPaginationService } from '@mykks32/pagination-relay';
import { MongoOffsetPaginationService } from '@mykks32/pagination-offset';
import { NotesController } from './controllers/notes.controller';
import { NotesService } from './services/notes.service';
import { Note, NoteSchema } from './schemas/note.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }])],
  controllers: [NotesController],
  // Both pagination services are registered here (rather than only in a
  // shared/global module) since NotesService is currently their only
  // consumer; add them to a shared module if a second feature module needs them.
  providers: [NotesService, MongoCursorPaginationService, MongoOffsetPaginationService],
})
export class NotesModule {}
