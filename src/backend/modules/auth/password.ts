import { eq } from 'drizzle-orm';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { revokeAllSessions } from '../../middleware/auth.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  const argon2 = await import('argon2');
  return argon2.hash(password, {
    type: argon2.argon2id,
    ...ARGON2_OPTIONS,
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const argon2 = await import('argon2');
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function createUser(email: string, password: string, role: 'admin' | 'user' = 'user') {
  const db = getDb();

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (existing) {
    throw new ValidationError('User with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    role,
  });

  return { id: userId, email, role };
}

/**
 * 校验账号密码，失败时按阈值锁定。
 *
 * 锁定只在连续失败达到阈值之后才触发：早先的实现是错一次就锁 15 分钟，
 * 于是输错一次的人即便随后输入了正确密码也只能看着 401 干等。
 */
export async function authenticateUser(
  email: string,
  password: string
): Promise<{ id: string; email: string; role: 'admin' | 'user' }> {
  const db = getDb();
  const env = getEnv();

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user || !user.isActive) {
    // 不区分"用户不存在"和"密码错误"，免得被用来枚举账号
    throw new AuthenticationError('Invalid email or password');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
    throw new AuthenticationError(
      `Too many failed attempts. This account is locked for another ${minutes} minute${
        minutes === 1 ? '' : 's'
      }.`
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    const shouldLock = attempts >= env.AUTH_MAX_LOGIN_ATTEMPTS;
    await db
      .update(users)
      .set({
        failedLoginAttempts: attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + env.AUTH_LOCKOUT_MINUTES * 60 * 1000)
          : null,
      })
      .where(eq(users.id, user.id));
    if (shouldLock) {
      throw new AuthenticationError(
        `Too many failed attempts. This account is locked for ${env.AUTH_LOCKOUT_MINUTES} minutes.`
      );
    }
    throw new AuthenticationError('Invalid email or password');
  }

  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));

  return { id: user.id, email: user.email, role: user.role };
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new NotFoundError('User', userId);
  }

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  await revokeAllSessions(userId);
}
