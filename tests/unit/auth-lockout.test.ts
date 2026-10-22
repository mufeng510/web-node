import { authenticateUser, hashPassword } from '@backend/modules/auth/password';
import { beforeEach, describe, expect, test, vi } from 'vitest';

process.env.MASTER_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.AUTH_MAX_LOGIN_ATTEMPTS = '3';
process.env.AUTH_LOCKOUT_MINUTES = '5';

/** 测试用的单个用户，mock 的数据库只认识它 */
let testUser: any = null;

vi.mock('@backend/db/index', () => ({
  getDb: vi.fn(() => ({
    query: {
      users: {
        findFirst: vi.fn(async () => testUser),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => ({
        where: vi.fn(async () => {
          Object.assign(testUser, values);
          return { changes: 1 };
        }),
      })),
    })),
  })),
  closeDb: vi.fn(),
  schema: {},
}));

const EMAIL = 'admin@example.com';
const PASSWORD = 'correct-password';

async function makeUser() {
  testUser = {
    id: 'u1',
    email: EMAIL,
    passwordHash: await hashPassword(PASSWORD),
    role: 'admin',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
  };
}

describe('Login lockout', () => {
  beforeEach(async () => {
    await makeUser();
  });

  test('accepts the right password', async () => {
    const user = await authenticateUser(EMAIL, PASSWORD);
    expect(user.email).toBe(EMAIL);
    expect(testUser.failedLoginAttempts).toBe(0);
  });

  test('a wrong password below the threshold does not lock the account', async () => {
    await expect(authenticateUser(EMAIL, 'wrong')).rejects.toThrow('Invalid email or password');
    expect(testUser.failedLoginAttempts).toBe(1);
    expect(testUser.lockedUntil).toBeNull();

    // The account must still accept the right password right away.
    await expect(authenticateUser(EMAIL, PASSWORD)).resolves.toMatchObject({ email: EMAIL });
    expect(testUser.failedLoginAttempts).toBe(0);
  });

  test('locks the account once the threshold is reached', async () => {
    for (let i = 0; i < 2; i++) {
      await expect(authenticateUser(EMAIL, 'wrong')).rejects.toThrow('Invalid email or password');
    }
    expect(testUser.lockedUntil).toBeNull();

    await expect(authenticateUser(EMAIL, 'wrong')).rejects.toThrow(
      'Too many failed attempts. This account is locked for 5 minutes.'
    );
    expect(testUser.lockedUntil).toBeInstanceOf(Date);
  });

  test('a locked account rejects even the right password, saying how long is left', async () => {
    testUser.failedLoginAttempts = 3;
    testUser.lockedUntil = new Date(Date.now() + 4 * 60 * 1000);

    await expect(authenticateUser(EMAIL, PASSWORD)).rejects.toThrow(
      /locked for another \d+ minutes?/
    );
  });

  test('an expired lock lets the right password through again', async () => {
    testUser.failedLoginAttempts = 3;
    testUser.lockedUntil = new Date(Date.now() - 1000);

    await expect(authenticateUser(EMAIL, PASSWORD)).resolves.toMatchObject({ email: EMAIL });
    expect(testUser.failedLoginAttempts).toBe(0);
    expect(testUser.lockedUntil).toBeNull();
  });

  test('an unknown account reports the same message as a wrong password', async () => {
    testUser = null;
    await expect(authenticateUser('nobody@example.com', 'whatever')).rejects.toThrow(
      'Invalid email or password'
    );
  });

  test('a disabled account is rejected', async () => {
    testUser.isActive = false;
    await expect(authenticateUser(EMAIL, PASSWORD)).rejects.toThrow('Invalid email or password');
  });
});
