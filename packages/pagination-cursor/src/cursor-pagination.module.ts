import { Module } from '@nestjs/common';
import { MongoCursorPaginationService } from './mongo/mongo-cursor-pagination.service';

/**
 * Registers {@link MongoCursorPaginationService} as a provider. Import this
 * module wherever a service/resolver wants to inject the cursor paginator
 * instead of calling the framework-agnostic `paginate()` export directly.
 */
@Module({
  providers: [MongoCursorPaginationService],
  exports: [MongoCursorPaginationService],
})
export class CursorPaginationModule {}
