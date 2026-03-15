import { AggregateRootBase } from './aggregate-root.base';
import { DomainEventBase } from './domain-event.base';

class TestEvent extends DomainEventBase {
  readonly eventType = 'TestEvent';
  constructor(public readonly data: string) {
    super();
  }
}

class TestAggregate extends AggregateRootBase {
  public state = '';

  get aggregateId(): string {
    return 'test-id';
  }

  doSomething(data: string): void {
    this.apply(new TestEvent(data));
  }

  protected applyEvent(event: DomainEventBase): void {
    if (event instanceof TestEvent) {
      this.state = event.data;
    }
  }
}

describe('AggregateRootBase', () => {
  it('initial version is -1', () => {
    const aggregate = new TestAggregate();

    expect(aggregate.version).toBe(-1);
  });

  it('apply() adds event to uncommitted events', () => {
    const aggregate = new TestAggregate();

    aggregate.doSomething('hello');

    const events = aggregate.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(TestEvent);
  });

  it('apply() mutates state via applyEvent()', () => {
    const aggregate = new TestAggregate();

    aggregate.doSomething('hello');

    expect(aggregate.state).toBe('hello');
  });

  it('clearUncommittedEvents() empties the list', () => {
    const aggregate = new TestAggregate();
    aggregate.doSomething('hello');
    aggregate.doSomething('world');

    expect(aggregate.getUncommittedEvents()).toHaveLength(2);

    aggregate.clearUncommittedEvents();

    expect(aggregate.getUncommittedEvents()).toHaveLength(0);
  });

  it('getUncommittedEvents() returns a copy', () => {
    const aggregate = new TestAggregate();
    aggregate.doSomething('hello');

    const events1 = aggregate.getUncommittedEvents();
    const events2 = aggregate.getUncommittedEvents();

    expect(events1).not.toBe(events2);
    expect(events1).toEqual(events2);
  });

  it('multiple apply() calls accumulate events', () => {
    const aggregate = new TestAggregate();
    aggregate.doSomething('first');
    aggregate.doSomething('second');

    const events = aggregate.getUncommittedEvents();
    expect(events).toHaveLength(2);
    expect((events[0] as TestEvent).data).toBe('first');
    expect((events[1] as TestEvent).data).toBe('second');
    // State reflects the last event
    expect(aggregate.state).toBe('second');
  });
});
