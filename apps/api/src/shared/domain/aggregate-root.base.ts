import type { DomainEventBase } from './domain-event.base';

export abstract class AggregateRootBase {
  private _uncommittedEvents: DomainEventBase[] = [];
  public version = -1;

  abstract get aggregateId(): string;

  protected apply(event: DomainEventBase): void {
    this._uncommittedEvents.push(event);
    this.applyEvent(event);
  }

  protected abstract applyEvent(event: DomainEventBase): void;

  getUncommittedEvents(): ReadonlyArray<DomainEventBase> {
    return [...this._uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this._uncommittedEvents = [];
  }
}
