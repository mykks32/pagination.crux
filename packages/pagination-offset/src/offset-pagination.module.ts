import { Module } from '@nestjs/common';
import { MongoOffsetPaginationService } from './mongo/mongo-offset-pagination.service';

/**
 * Registers {@link MongoOffsetPaginationService} as a provider. Import this
 * module wherever a service/resolver wants to inject the offset paginator
 * instead of calling the framework-agnostic `paginate()` export directly.
 */
@Module({
  providers: [MongoOffsetPaginationService],
  exports: [MongoOffsetPaginationService],
})
export class OffsetPaginationModule {}
