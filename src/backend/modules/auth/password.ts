import { getDb } from '@backend/db/index';
import { users } from '@backend/db/schema/users';
import { AuthenticationError, NotFoundError, ValidationError } from '@backend/utils/errors';
import { createId } from '@backend/utils/id';
import { eq } from 'drizzle-orm';

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

export async function authenticateUser(email: string, password: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    await incrementFailedAttempts(email);
    throw new AuthenticationError('Invalid credentials');
  }

  if (!user.isActive) {
    throw new AuthenticationError('Account is disabled');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AuthenticationError('Account is temporarily locked');
  }

  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    await incrementFailedAttempts(email);
    throw new AuthenticationError('Invalid credentials');
  }

  await resetFailedAttempts(user.id);

  return user;
}

async function incrementFailedAttempts(email: string) {
  const db = getDb();
  const _env = getEnv();
  await db
    .update(users)
    .set({
      failedLoginAttempts: { increment: 1 },
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    })
    .where(eq(users.email, email));
}

async function resetFailedAttempts(userId: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, userId));
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
