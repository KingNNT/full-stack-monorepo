/**
 * Integration event published by User context after a profile change.
 * Consumed by Auth context to sync credentials (username mirror).
 */
export class UserProfileUpdatedIntegrationEvent {
  constructor(
    public readonly userId: string,
    public readonly username: string,
  ) {}
}
