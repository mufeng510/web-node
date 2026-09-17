import { eq } from 'drizzle-orm';
import { getDb } from '../../db/index.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

export async function getAllUsers() {
  const db = getDb();
  return db.query.users.findMany({
    orderBy: (users, { desc }) => [desc(users.createdAt)],
  });
}

export async function getUserById(id: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  if (!user) throw new NotFoundError('User', id);
  return user;
}

export async function createUserAdmin(email: string, password: string, role: 'admin' | 'user') {
  const { hashPassword } = await import('./password.js');
  const passwordHash = await hashPassword(password);

  const db = getDb();
  const userId = createId();

  await db.insert(users).values({
    id: userId,
    email,
    passwordHash,
    role,
  });

  return { id: userId, email, role };
}

export async function updateUser(
  id: string,
  data: { email?: string; role?: 'admin' | 'user'; isActive?: boolean }
) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new NotFoundError('User', id);

  if (data.email) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, data.email) });
    if (existing && existing.id !== id) {
      throw new ValidationError('Email already in use');
    }
  }

  await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id));

  return getUserById(id);
}

export async function deleteUser(id: string) {
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new NotFoundError('User', id);

  await db.delete(users).where(eq(users.id, id));
}

export async function unlockUser(id: string) {
  const db = getDb();
  await db
    .update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, isActive: true, updatedAt: new Date() })
    .where(eq(users.id, id));
}

function desc<T>(_fn: (t: T) => any) {
  return { desc: true };
}
