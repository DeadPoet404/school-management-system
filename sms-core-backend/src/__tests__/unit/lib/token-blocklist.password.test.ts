import { describe, expect, it } from 'vitest';
import {
  invalidateUserTokensBefore,
  isUserInvalidated,
} from '@/lib/token-blocklist';

describe('password-change token invalidation', () => {
  it('keeps the newest invalidation threshold', () => {
    const accountId = 'password-test-account';

    invalidateUserTokensBefore(accountId, 100);
    invalidateUserTokensBefore(accountId, 200);
    invalidateUserTokensBefore(accountId, 150);

    expect(isUserInvalidated(accountId, 200)).toBe(true);
    expect(isUserInvalidated(accountId, 199)).toBe(true);
    expect(isUserInvalidated(accountId, 201)).toBe(false);
  });
});
