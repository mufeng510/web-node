import { zValidator } from '@hono/zod-validator';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { libraries } from '../../db/schema/libraries.js';
import { mcpTokens } from '../../db/schema/mcp_tokens.js';
import { checkLibraryAccess } from '../../libraries/access.js';
import { auditLog } from '../../middleware/audit.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { generateApiKey, hashSecret } from '../../utils/crypto.js';
import { NotFoundError } from '../../utils/errors.js';
import { createId } from '../../utils/id.js';

const mcpRoutes = new Hono();

mcpRoutes.use('*', authMiddleware());

mcpRoutes.get(
  '/tokens',
  zValidator(
    'query',
    z.object({
      libraryId: z.string().uuid().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { libraryId } = c.req.valid('query');
    const db = getDb();

    let query = db.select().from(mcpTokens).where(eq(mcpTokens.libraryId, libraryId!));

    if (libraryId) {
      await checkLibraryAccess(userId, libraryId);
      query = query.where(eq(mcpTokens.libraryId, libraryId));
    } else {
      const { libraryMembers } = await import('../db/schema/libraries.js');
      const { eq, and } = await import('drizzle-orm');
      const accessible = await getAccessibleLibraries(userId, c.get('userRole'));
      const ids = accessible.map((l) => l.id);
      query = query.where(inArray(mcpTokens.libraryId, ids));
    }

    query = query.orderBy(desc(mcpTokens.createdAt));

    const tokens = await query.execute();

    return c.json({
      success: true,
      data: tokens.map((t) => ({
        id: t.id,
        name: t.name,
        libraryId: t.libraryId,
        permissions: t.permissions,
        expiresAt: t.expiresAt,
        revokedAt: t.revokedAt,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
      })),
    });
  }
);

mcpRoutes.post(
  '/tokens',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).max(100),
      libraryId: z.string().uuid(),
      permissions: z.object({
        read: z.boolean().default(true),
        write: z.boolean().default(false),
        git: z.boolean().default(false),
      }),
      expiresAt: z.string().datetime().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const { name, libraryId, permissions, expiresAt } = c.req.valid('json');
    const db = getDb();

    const { library } = await checkLibraryAccess(userId, libraryId, 'admin');

    const token = generateApiKey();
    const tokenHash = hashSecret(token);
    const tokenId = createId();

    await db.insert(mcpTokens).values({
      id: tokenId,
      name,
      tokenHash,
      libraryId,
      permissions,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    auditLog({
      userId,
      libraryId,
      action: 'mcp.token.create',
      resourceType: 'mcp_token',
      resourceId: tokenId,
      metadata: { name, permissions },
    });

    return c.json({ success: true, data: { id: tokenId, token } }, 201);
  }
);

mcpRoutes.delete('/tokens/:id', async (c) => {
  const userId = c.get('userId');
  const tokenId = c.req.param('id');
  const db = getDb();

  const token = await db.query.mcpTokens.findFirst({ where: eq(mcpTokens.id, tokenId) });
  if (!token) throw new NotFoundError('MCP Token', tokenId);

  await checkLibraryAccess(userId, token.libraryId, 'admin');

  await db.update(mcpTokens).set({ revokedAt: new Date() }).where(eq(mcpTokens.id, tokenId));

  auditLog({
    userId,
    libraryId: token.libraryId,
    action: 'mcp.token.revoke',
    resourceType: 'mcp_token',
    resourceId: tokenId,
  });

  return c.json({ success: true });
});

mcpRoutes.get('/:tokenId/manifest', async (c) => {
  const tokenId = c.req.param('tokenId');
  const authHeader = c.req.header('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const providedToken = authHeader.slice(7);
  const tokenHash = hashSecret(providedToken);
  const db = getDb();

  const token = await db.query.mcpTokens.findFirst({
    where: eq(mcpTokens.tokenHash, tokenHash),
  });

  if (!token || token.id !== tokenId) {
    return c.json({ error: 'Invalid token' }, 401);
  }

  if (token.revokedAt) {
    return c.json({ error: 'Token revoked' }, 401);
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    return c.json({ error: 'Token expired' }, 401);
  }

  const library = await db.query.libraries.findFirst({ where: eq(libraries.id, token.libraryId) });
  if (!library) {
    return c.json({ error: 'Library not found' }, 404);
  }

  return c.json({
    name: 'Web Note MCP Server',
    version: '0.1.0',
    tools: [
      { name: 'read_file', description: 'Read a file from the library' },
      { name: 'list_directory', description: 'List directory contents' },
      { name: 'search_files', description: 'Search files in the library' },
      { name: 'get_file_metadata', description: 'Get file metadata' },
      { name: 'create_file', description: 'Create a new file' },
      { name: 'edit_file', description: 'Edit an existing file' },
      { name: 'rename_file', description: 'Rename a file' },
      { name: 'move_file', description: 'Move a file' },
      { name: 'delete_file', description: 'Delete a file (to trash)' },
      { name: 'git_status', description: 'Get Git status' },
      { name: 'git_commit', description: 'Commit changes' },
      { name: 'git_push', description: 'Push to remote' },
      { name: 'git_pull', description: 'Pull from remote' },
    ],
  });
});

async function getAccessibleLibraries(userId: string, userRole: string) {
  const db = getDb();
  if (userRole === 'admin') return db.query.libraries.findMany();
  const { libraryMembers } = await import('../db/schema/libraries.js');
  const { eq, and } = await import('drizzle-orm');
  const owned = await db.query.libraries.findMany({ where: eq(libraries.ownerId, userId) });
  const memberships = await db.query.libraryMembers.findMany({
    where: eq(libraryMembers.userId, userId),
    with: { library: true },
  });
  return [...owned, ...memberships.map((m) => m.library).filter(Boolean)];
}

function inArray(column: any, values: any[]) {
  return { in: [column, values] };
}

export default mcpRoutes;
