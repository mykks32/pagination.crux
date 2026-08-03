/** Wires together the Note Mongoose model, all three pagination modules, and the Notes controller/service. */
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RelayPaginationModule } from '@mykks32/pagination-relay';
import { CursorPaginationModule } from '@mykks32/pagination-cursor';
import { OffsetPaginationModule } from '@mykks32/pagination-offset';
import { NotesController } from './controllers/notes.controller';
import { NotesService } from './services/notes.service';
import { Note, NoteSchema } from './schemas/note.schema';

@Module({
  // Each package's own module exports its MongoCursorPaginationService/
  // MongoOffsetPaginationService as a provider — imported here (rather than
  // registered directly) so NotesService gets them via Nest's DI container
  // without this module needing to know their internals. Relay's and
  // cursor's service classes share a name (MongoCursorPaginationService)
  // but are unrelated engines — Nest keys providers by class reference, not
  // name, so both register and inject independently.
  imports: [
    MongooseModule.forFeature([{ name: Note.name, schema: NoteSchema }]),
    RelayPaginationModule,
    CursorPaginationModule,
    OffsetPaginationModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
