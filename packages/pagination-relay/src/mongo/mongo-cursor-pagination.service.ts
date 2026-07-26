import { Injectable } from '@nestjs/common';
import type { Model } from 'mongoose';
import type { MongoCursorPaginationOptions } from '../interfaces/mongo-cursor-pagination-options.interface';
import type { PaginatedResult } from '../interfaces/pagination.interface';
import { paginate } from './mongo-cursor-paginator';

/**
 * Injectable Nest wrapper around the framework-agnostic `paginate` function.
 * Register it as a provider and inject it into services/resolvers that need
 * cursor pagination over a Mongoose model.
 *
 * @example
 * ```ts
 * constructor(
 *   @InjectModel(User.name) private readonly userModel: Model<User>,
 *   private readonly paginationService: MongoCursorPaginationService,
 * ) {}
 *
 * findUsers(args: CursorPaginationArgs) {
 *   return this.paginationService.paginate(this.userModel, {
 *     args,
 *     sort: [{ field: 'createdAt', direction: 'DESC' }],
 *     filter: { deletedAt: null },
 *   });
 * }
 * ```
 */
@Injectable()
export class MongoCursorPaginationService {
  /**
   * Cursor-paginates `model` per `options`. Thin passthrough to the
   * framework-agnostic `paginate()` — exists only so consumers can get this
   * behavior via Nest's DI container instead of importing the function
   * directly.
   *
   * @param model Mongoose model to query.
   * @param options Sort, filter, and Relay-style args controlling the page returned.
   */
  paginate<T>(model: Model<T>, options: MongoCursorPaginationOptions<T>): Promise<PaginatedResult<T>> {
    return paginate(model, options);
  }
}
