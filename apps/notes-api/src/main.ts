/** Application entry point: bootstraps Nest, wires global pipes/versioning, and starts listening. */
import 'reflect-metadata';
import { ClassSerializerInterceptor, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

const logger = new Logger("Bootstrap")

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // URI versioning: every controller is mounted under /v1 by default
  // (`@Controller('notes')` -> `/v1/notes`), so breaking API changes later
  // can ship as `/v2` alongside it instead of breaking existing clients.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Global validation: strips unknown properties (whitelist), rejects
  // requests that include them (forbidNonWhitelisted), and runs
  // class-transformer conversions declared on DTOs (transform) before a
  // controller method ever sees the payload.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global response serialization: walks every returned value (including
  // nested arrays/objects, e.g. paginated `edges[].node`) and applies each
  // response DTO's @Exclude/@Expose metadata, so Mongoose-internal fields
  // never leak into an HTTP response even if a controller method forgets
  // to map through a response DTO itself.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const config = app.get(ConfigService<AppConfig, true>);
  const port = config.get('port', { infer: true });

  await app.listen(port);

  logger.log(`notes-api listening on http://localhost:${port}/v1`);
}

void bootstrap();
