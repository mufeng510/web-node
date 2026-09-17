import { zValidator } from '@hono/zod-validator';
import { desc, eq, like, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { files } from '../../db/schema/files.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { checkLibraryAccess } from '../libraries/access.js';

const searchRoutes = new Hono();

searchRoutes.use('*', authMiddleware());

searchRoutes.get(
  '/:libraryId',
  zValidator(
    'query',
    z.object({
      q: z.string().min(1),
      scope: z
        .enum(['all', 'filename', 'content', 'frontmatter', 'tags', 'wikilinks'])
        .default('all'),
      type: z.enum(['exact', 'fuzzy']).default('fuzzy'),
      path: z.string().optional(),
      tags: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { q, scope, type, path, tags, limit, cursor } = c.req.valid('query');

    const { library } = await checkLibraryAccess(userId, libraryId);

    const db = getDb();
    const tagArray = tags?.split(',').filter(Boolean) || [];

    let query = db.select().from(files).where(eq(files.libraryId, libraryId));

    if (scope === 'filename' || scope === 'all') {
      query = query.where(like(files.name, type === 'exact' ? q : `%${q}%`));
    }

    if (scope === 'content' || scope === 'all') {
      query = query.where(like(files.content || '', type === 'exact' ? q : `%${q}%`));
    }

    if (path) {
      query = query.where(like(files.path, `${path}%`));
    }

    if (tagArray.length > 0) {
      const tagConditions = tagArray.map((tag) =>
        like(files.frontmatter || '', `%"tags":%${tag}%`)
      );
      query = query.where(or(...tagConditions));
    }

    if (cursor) {
      query = query.where(gt(files.updatedAt, new Date(cursor)));
    }

    query = query.orderBy(desc(files.updatedAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : undefined;

    return c.json({
      success: true,
      data: {
        items: items.map((f) => ({
          id: f.id,
          path: f.path,
          name: f.name,
          isDir: f.isDir,
          size: f.size,
          mimeType: f.mimeType,
          mtime: f.mtime,
          frontmatter: f.frontmatter,
        })),
        nextCursor,
        hasMore,
      },
    });
  }
);

searchRoutes.get(
  '/global',
  zValidator(
    'query',
    z.object({
      q: z.string().min(1),
      scope: z
        .enum(['all', 'filename', 'content', 'frontmatter', 'tags', 'wikilinks'])
        .default('all'),
      type: z.enum(['exact', 'fuzzy']).default('fuzzy'),
      libraryId: z.string().uuid().optional(),
      tags: z.string().optional(),
      limit: z.coerce.number().int().positive().max(100).default(20),
      cursor: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const { q, scope, type, libraryId, tags, limit, cursor } = c.req.valid('query');

    const db = getDb();
    const tagArray = tags?.split(',').filter(Boolean) || [];

    let libraryIds: string[];

    if (libraryId) {
      const { library } = await checkLibraryAccess(userId, libraryId);
      libraryIds = [library.id];
    } else if (userRole === 'admin') {
      libraryIds = (await db.query.libraries.findMany()).map((l) => l.id);
    } else {
      const accessible = await getAccessibleLibraries(userId, userRole);
      libraryIds = accessible.map((l) => l.id);
    }

    if (libraryIds.length === 0) {
      return c.json({ success: true, data: { items: [], nextCursor: undefined, hasMore: false } });
    }

    let query = db.select().from(files).where(inArray(files.libraryId, libraryIds));

    if (scope === 'filename' || scope === 'all') {
      query = query.where(like(files.name, type === 'exact' ? q : `%${q}%`));
    }

    if (scope === 'content' || scope === 'all') {
      query = query.where(like(files.content || '', type === 'exact' ? q : `%${q}%`));
    }

    if (tagArray.length > 0) {
      const tagConditions = tagArray.map((tag) =>
        like(files.frontmatter || '', `%"tags":%${tag}%`)
      );
      query = query.where(or(...tagConditions));
    }

    if (cursor) {
      query = query.where(gt(files.updatedAt, new Date(cursor)));
    }

    query = query.orderBy(desc(files.updatedAt)).limit(limit + 1);

    const results = await query.execute();
    const hasMore = results.length > limit;
    const items = hasMore ? results.slice(0, limit) : results;
    const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : undefined;

    return c.json({
      success: true,
      data: {
        items: items.map((f) => ({
          id: f.id,
          libraryId: f.libraryId,
          path: f.path,
          name: f.name,
          isDir: f.isDir,
          size: f.size,
          mimeType: f.mimeType,
          mtime: f.mtime,
          frontmatter: f.frontmatter,
        })),
        nextCursor,
        hasMore,
      },
    });
  }
);

function inArray(column: any, values: any[]) {
  return { in: [column, values] };
}

function gt(column: any, value: any) {
  return { gt: [column, value] };
}

export default searchRoutes;
