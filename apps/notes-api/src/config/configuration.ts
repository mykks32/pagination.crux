/**
 * Central place for reading/typing environment variables. Consumed via
 * `@nestjs/config`'s `ConfigService.get<T>('key')`, so the rest of the app
 * never touches `process.env` directly.
 */
export interface AppConfig {
  mongodbUri: string;
  port: number;
}

/** Factory passed to `ConfigModule.forRoot({ load: [configuration] })`. */
export default function configuration(): AppConfig {
  return {
    mongodbUri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/notes_db',
    port: Number(process.env.PORT) || 3000,
  };
}
