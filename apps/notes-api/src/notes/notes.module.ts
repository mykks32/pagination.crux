/** Wires together the Note Mongoose model, all three pagination services, and the Notes controller/service. */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoCursorPaginationService as RelayMongoCursorPaginationService } from '@mykks32/pagination-relay';
import { MongoCursorPaginationService as CursorMongoCursorPaginationService } from '@mykks32/pagination-cursor';
import { MongoOffsetPaginationService } from '@mykks32/pagination-offset';
import { NotesController } from './controllers/notes.controller';
import { NotesService } from './services/notes.service';
import { Note, NoteSchema } from './schemas/note.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }])],
  controllers: [NotesController],
  // All three pagination services are registered here (rather than only in
  // a shared/global module) since NotesService is currently their only
  // consumer; add them to a shared module if a second feature module needs
  // them. Relay's and cursor's classes share a name (MongoCursorPaginationService)
  // but are unrelated engines — Nest keys providers by class reference, not
  // name, so both register and inject independently despite the alias.
  providers: [NotesService, RelayMongoCursorPaginationService, CursorMongoCursorPaginationService, MongoOffsetPaginationService],
})
export class NotesModule {}
