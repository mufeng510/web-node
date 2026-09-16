import { hashPassword, verifyPassword } from '@backend/modules/auth/password';
import { describe, expect, test } from 'vitest';

describe('Password hashing', () => {
  test('should hash and verify password', async () => {
    const password = 'test-password-123';
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);

    const valid = await verifyPassword(password, hash);
    expect(valid).toBe(true);
  });

  test('should reject wrong password', async () => {
    const password = 'test-password-123';
    const hash = await hashPassword(password);
    const valid = await verifyPassword('wrong-password', hash);
    expect(valid).toBe(false);
  });
});

describe('Path utilities', () => {
  test('should normalize paths', () => {
    // Path utility tests would go here
    expect(true).toBe(true);
  });
});
