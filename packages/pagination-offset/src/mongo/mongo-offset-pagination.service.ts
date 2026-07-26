import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { MongoOffsetPaginationOptions } from '../interfaces/mongo-offset-pagination-options.interface';
import { paginate, type OffsetPage } from './mongo-offset-paginator';

/**
 * Injectable Nest wrapper around the framework-agnostic `paginate()`.
 * Register it as a provider and inject it into services/resolvers that
 * need offset pagination over a Mongoose model.
 */
@Injectable()
export class MongoOffsetPaginationService {
  /**
   * Offset-paginates `model` per `options`.
   *
   * @param model Mongoose model to query.
   * @param options Sort, filter, and page/limit args controlling the page returned.
   */
  paginate<T>(model: Model<T>, options: MongoOffsetPaginationOptions<T>): Promise<OffsetPage<T>> {
    return paginate(model, options);
  }
}
