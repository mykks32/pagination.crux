/** Application root module: global config + the Mongo connection + feature modules. */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration, { type AppConfig } from './config/configuration';
import { NotesModule } from './notes/notes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      // Async form so the URI comes from ConfigService (and therefore from
      // configuration()/.env), rather than being hardcoded at module-load time.
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        uri: config.get('mongodbUri', { infer: true }),
      }),
    }),
    NotesModule,
  ],
})
export class AppModule {}
