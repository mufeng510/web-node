import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { libraries } from '../db/schema/libraries.js';
import { libraryMembers } from '../db/schema/libraries.js';
import { AuthorizationError, NotFoundError } from '../utils/errors.js';

export async function checkLibraryAccess(
  userId: string,
  libraryId: string,
  requiredRole?: 'owner' | 'admin' | 'member'
) {
  const db = getDb();

  const library = await db.query.libraries.findFirst({
    where: eq(libraries.id, libraryId),
  });

  if (!library) {
    throw new NotFoundError('Library', libraryId);
  }

  if (library.ownerId === userId) {
    return { library, role: 'owner' };
  }

  const member = await db.query.libraryMembers.findFirst({
    where: and(eq(libraryMembers.libraryId, libraryId), eq(libraryMembers.userId, userId)),
  });

  if (!member) {
    throw new AuthorizationError('Access denied to this library');
  }

  if (requiredRole) {
    const roleHierarchy = { owner: 3, admin: 2, member: 1 };
    if (roleHierarchy[member.role] < roleHierarchy[requiredRole]) {
      throw new AuthorizationError(`Requires ${requiredRole} role`);
    }
  }

  return { library, role: member.role };
}

export async function getAccessibleLibraries(userId: string, userRole: string) {
  const db = getDb();

  if (userRole === 'admin') {
    return db.query.libraries.findMany();
  }

  const owned = await db.query.libraries.findMany({
    where: eq(libraries.ownerId, userId),
  });

  const memberships = await db.query.libraryMembers.findMany({
    where: eq(libraryMembers.userId, userId),
    with: { library: true },
  });

  const shared = memberships.map((m) => m.library).filter(Boolean);

  return [...owned, ...shared];
}
