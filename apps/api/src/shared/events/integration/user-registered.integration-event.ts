/**
 * Integration event published by User context after a user is created.
 * Consumed by Auth context to sync credentials.
 * Uses only primitive types (no value objects) — cross-context contract.
 */
export class UserRegisteredIntegrationEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly username: string,
  ) {}
}
