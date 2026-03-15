import type { AggregateRootBase } from '../domain/aggregate-root.base';

export const UNIT_OF_WORK_TOKEN = Symbol('IUnitOfWork');

export interface IUnitOfWork {
  commit(aggregate: AggregateRootBase): Promise<void>;
}
