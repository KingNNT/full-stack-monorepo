import { UserProfileUpdatedEvent } from '../events/user-profile-updated.event';
import { UserAggregate } from './user.aggregate';

describe('UserAggregate.updateProfile', () => {
  function newUser() {
    const user = UserAggregate.create({
      email: 'test@example.com',
      username: 'oldname',
    });
    user.clearUncommittedEvents();
    return user;
  }

  it('emits UserProfileUpdatedEvent when username changes', () => {
    const user = newUser();

    user.updateProfile({ username: 'newname' });

    const events = user.getUncommittedEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(UserProfileUpdatedEvent);

    const event = events[0] as UserProfileUpdatedEvent;
    expect(event.payload.userId).toBe(user.aggregateId);
    expect(event.payload.username).toBe('newname');
    expect(event.payload.updatedAt).toBeInstanceOf(Date);
  });

  it('updates state after applying event', () => {
    const user = newUser();

    user.updateProfile({ username: 'newname' });

    expect(user.username.value).toBe('newname');
  });

  it('emits no event when username is unchanged', () => {
    const user = newUser();

    user.updateProfile({ username: 'oldname' });

    expect(user.getUncommittedEvents()).toHaveLength(0);
  });

  it('rejects invalid username', () => {
    const user = newUser();

    expect(() => user.updateProfile({ username: 'a' })).toThrow();
    expect(user.getUncommittedEvents()).toHaveLength(0);
  });
});
