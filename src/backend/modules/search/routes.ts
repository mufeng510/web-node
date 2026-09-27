import { readFile } from 'node:fs/promises';
import { zValidator } from '@hono/zod-validator';
import { type SQL, and, desc, eq, inArray, like, lt, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { files } from '../../db/schema/files.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { getAbsolutePath } from '../../utils/path.js';
import { checkLibraryAccess, getAccessibleLibraries } from '../libraries/access.js';

const searchRoutes = new Hono();

searchRoutes.use('*', authMiddleware());

const searchQuerySchema = z.object({
  q: z.string().min(1),
  scope: z.enum(['all', 'filename', 'content', 'frontmatter', 'tags', 'wikilinks']).default('all'),
  type: z.enum(['exact', 'fuzzy']).default('fuzzy'),
  tags: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

function fuzzyPattern(q: string, type: string) {
  return type === 'exact' ? q : `%${q}%`;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type FileRow = typeof files.$inferSelect;

function paginate<T extends { updatedAt: Date }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1]?.updatedAt.toISOString() : undefined;
  return { items, nextCursor, hasMore };
}

const SCAN_CAP = 1000;

async function scanCandidates(
  candidates: FileRow[],
  libraryPaths: Map<string, string>,
  predicate: (content: string) => boolean
): Promise<FileRow[]> {
  const matched: FileRow[] = [];
  for (const file of candidates.slice(0, SCAN_CAP)) {
    if (file.isDir) continue;
    const root = libraryPaths.get(file.libraryId);
    if (!root) continue;
    try {
      const content = await readFile(getAbsolutePath(root, file.path), 'utf-8');
      if (predicate(content)) matched.push(file);
    } catch {
      // unreadable file: skip
    }
  }
  return matched;
}

function contentPredicate(q: string, type: string, wikilinksOnly: boolean) {
  if (wikilinksOnly) {
    const re = new RegExp(`\\[\\[[^\\]]*${escapeRegExp(q)}`, 'i');
    return (content: string) => re.test(content);
  }
  if (type === 'exact') {
    return (content: string) => content.includes(q);
  }
  return (content: string) => content.toLowerCase().includes(q.toLowerCase());
}

async function runSearch(
  db: ReturnType<typeof getDb>,
  opts: {
    libraryFilter: SQL;
    libraryPaths: Map<string, string>;
    extra: SQL[];
    scope: string;
    pattern: string;
    q: string;
    type: string;
    limit: number;
  }
): Promise<FileRow[]> {
  const { libraryFilter, libraryPaths, extra, scope, pattern, q, type, limit } = opts;

  if (scope === 'filename' || scope === 'frontmatter' || scope === 'tags') {
    const column = scope === 'filename' ? files.name : files.frontmatter;
    const value = scope === 'tags' ? `%"tags":%${q}%` : pattern;
    return db
      .select()
      .from(files)
      .where(and(libraryFilter, like(column, value), ...extra))
      .orderBy(desc(files.updatedAt))
      .limit(limit + 1)
      .execute();
  }

  const nameMatches =
    scope === 'all'
      ? await db
          .select()
          .from(files)
          .where(and(libraryFilter, like(files.name, pattern), ...extra))
          .orderBy(desc(files.updatedAt))
          .limit(limit + 1)
          .execute()
      : [];
  const candidates = await db
    .select()
    .from(files)
    .where(and(libraryFilter, ...extra))
    .orderBy(desc(files.updatedAt))
    .limit(SCAN_CAP)
    .execute();
  const predicate = contentPredicate(q, type, scope === 'wikilinks');
  const contentMatches = await scanCandidates(candidates, libraryPaths, predicate);
  const seen = new Set(nameMatches.map((f) => f.id));
  const merged = [...nameMatches];
  for (const f of contentMatches) {
    if (!seen.has(f.id)) {
      seen.add(f.id);
      merged.push(f);
    }
  }
  merged.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return merged;
}

// NOTE: '/global' must be registered before '/:libraryId',
// otherwise 'global' matches the :libraryId param.
searchRoutes.get(
  '/global',
  zValidator(
    'query',
    searchQuerySchema.extend({
      libraryId: z.string().min(1).optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const userRole = c.get('userRole');
    const { q, scope, type, libraryId, tags, limit, cursor } = c.req.valid('query');

    const db = getDb();
    const tagArray = tags?.split(',').filter(Boolean) || [];

    let libraryIds: string[];
    const libraryPaths = new Map<string, string>();

    if (libraryId) {
      const { library } = await checkLibraryAccess(userId, libraryId);
      libraryIds = [library.id];
      libraryPaths.set(library.id, library.path);
    } else if (userRole === 'admin') {
      const all = await db.query.libraries.findMany();
      libraryIds = all.map((l) => l.id);
      for (const l of all) libraryPaths.set(l.id, l.path);
    } else {
      const accessible = await getAccessibleLibraries(userId, userRole);
      libraryIds = accessible.map((l) => l.id);
      for (const l of accessible) libraryPaths.set(l.id, l.path);
    }

    if (libraryIds.length === 0) {
      return c.json({ success: true, data: { items: [], nextCursor: undefined, hasMore: false } });
    }

    const extra = [];
    if (tagArray.length > 0) {
      const tagConditions = tagArray.map((tag) => like(files.frontmatter, `%"tags":%${tag}%`));
      const tagsCondition = or(...tagConditions);
      if (tagsCondition) extra.push(tagsCondition);
    }
    if (cursor) {
      extra.push(lt(files.updatedAt, new Date(cursor)));
    }

    const pattern = fuzzyPattern(q, type);
    const rows = await runSearch(db, {
      libraryFilter: inArray(files.libraryId, libraryIds),
      libraryPaths,
      extra,
      scope,
      pattern,
      q,
      type,
      limit,
    });
    const { items, nextCursor, hasMore } = paginate(rows, limit);

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

searchRoutes.get(
  '/:libraryId',
  zValidator(
    'query',
    searchQuerySchema.extend({
      path: z.string().optional(),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { q, scope, type, path, tags, limit, cursor } = c.req.valid('query');

    const { library } = await checkLibraryAccess(userId, libraryId);

    const db = getDb();
    const tagArray = tags?.split(',').filter(Boolean) || [];
    const libraryPaths = new Map([[library.id, library.path]]);

    const extra: SQL[] = [];
    if (path) {
      extra.push(like(files.path, `${path}%`));
    }
    if (tagArray.length > 0) {
      const tagConditions = tagArray.map((tag) => like(files.frontmatter, `%"tags":%${tag}%`));
      const tagsCondition = or(...tagConditions);
      if (tagsCondition) extra.push(tagsCondition);
    }
    if (cursor) {
      extra.push(lt(files.updatedAt, new Date(cursor)));
    }

    const pattern = fuzzyPattern(q, type);
    const rows = await runSearch(db, {
      libraryFilter: eq(files.libraryId, library.id),
      libraryPaths,
      extra,
      scope,
      pattern,
      q,
      type,
      limit,
    });
    const { items, nextCursor, hasMore } = paginate(rows, limit);

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

export default searchRoutes;
