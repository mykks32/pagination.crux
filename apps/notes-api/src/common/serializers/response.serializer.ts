/**
 * Generic serialization boundary between a persistence model (Mongoose
 * document or plain object) and a response DTO. `excludeAll` +
 * `excludeExtraneousValues: true` means only fields the DTO explicitly
 * `@Expose()`s ever survive — adding a new field to a Mongoose schema
 * can never accidentally leak it into an HTTP response, since the DTO,
 * not the source object, decides what's exposed.
 */
import { plainToInstance } from 'class-transformer';
import type { ClassConstructor } from 'class-transformer';

export function response<T>(cls: ClassConstructor<T>, source: object): T {
  return plainToInstance(cls, source, {
    strategy: 'excludeAll',
    exposeUnsetFields: false,
    excludeExtraneousValues: true,
  });
}
