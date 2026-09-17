import { readFile } from 'node:fs/promises';
import { zValidator } from '@hono/zod-validator';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../../db/index.js';
import { files } from '../../db/schema/files.js';
import { checkLibraryAccess } from '../../libraries/access.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { getAbsolutePath } from '../../utils/path.js';

const editorRoutes = new Hono();

editorRoutes.use('*', authMiddleware());

editorRoutes.get('/:libraryId/*/wikilinks', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const _filePath = c.req.param('*') || '';
  const query = c.req.query('q') || '';

  await checkLibraryAccess(userId, libraryId);
  const db = getDb();

  const allFiles = await db.query.files.findMany({
    where: and(eq(files.libraryId, libraryId), eq(files.isDir, false)),
  });

  const suggestions = allFiles
    .filter(
      (f) =>
        f.name.toLowerCase().includes(query.toLowerCase()) ||
        f.path.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 20)
    .map((f) => ({
      path: f.path,
      name: f.name,
      displayName: f.name.replace(/\.md$/, ''),
    }));

  return c.json({ success: true, data: { suggestions } });
});

editorRoutes.post(
  '/:libraryId/*/rename-ref',
  zValidator(
    'json',
    z.object({
      oldPath: z.string().min(1),
      newPath: z.string().min(1),
      updateWikilinks: z.boolean().default(true),
      updateMarkdownLinks: z.boolean().default(true),
      updateEmbeds: z.boolean().default(true),
    })
  ),
  async (c) => {
    const userId = c.get('userId');
    const libraryId = c.req.param('libraryId');
    const { oldPath, newPath, updateWikilinks, updateMarkdownLinks, updateEmbeds } =
      c.req.valid('json');

    const { library } = await checkLibraryAccess(userId, libraryId);
    const config = await readLibraryConfig(library.path);
    if (config?.readOnly) throw new AuthorizationError('Library is read-only');

    const db = getDb();
    const allFiles = await db.query.files.findMany({
      where: and(eq(files.libraryId, libraryId), eq(files.isDir, false)),
    });

    const updates: Record<string, unknown>[] = [];

    for (const file of allFiles) {
      const absolutePath = getAbsolutePath(library.path, file.path);
      try {
        let content = await readFile(absolutePath, 'utf-8');
        let modified = false;

        if (updateWikilinks) {
          const wikilinkRegex =
            /\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]]+))?(?:\|([^\]]+))?\]\]/g;
          content = content.replace(wikilinkRegex, (match, target, heading, blockId, alias) => {
            if (target === oldPath || target === oldPath.replace(/\.md$/, '')) {
              modified = true;
              const newTarget = newPath.replace(/\.md$/, '');
              return `[[${newTarget}${heading ? `#${heading}` : ''}${blockId ? `^${blockId}` : ''}${alias ? `|${alias}` : ''}]]`;
            }
            return match;
          });
        }

        if (updateMarkdownLinks) {
          const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
          content = content.replace(linkRegex, (match, text, url) => {
            if (url === oldPath || url === `./${oldPath}` || url === `${oldPath}`) {
              modified = true;
              return `[${text}](${newPath})`;
            }
            return match;
          });
        }

        if (updateEmbeds) {
          const embedRegex = /!\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]]+))?(?:\|([^\]]+))?\]\]/g;
          content = content.replace(embedRegex, (match, target, heading, blockId, alias) => {
            if (target === oldPath || target === oldPath.replace(/\.md$/, '')) {
              modified = true;
              const newTarget = newPath.replace(/\.md$/, '');
              return `![[${newTarget}${heading ? `#${heading}` : ''}${blockId ? `^${blockId}` : ''}${alias ? `|${alias}` : ''}]]`;
            }
            return match;
          });
        }

        if (modified) {
          await writeFile(absolutePath, content, 'utf-8');
          updates.push({ path: file.path, modified: true });
        }
      } catch (error) {
        updates.push({
          path: file.path,
          modified: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return c.json({ success: true, data: { updates } });
  }
);

editorRoutes.get('/:libraryId/*/backlinks', async (c) => {
  const userId = c.get('userId');
  const libraryId = c.req.param('libraryId');
  const filePath = c.req.param('*') || '';

  const { library } = await checkLibraryAccess(userId, libraryId);
  const db = getDb();

  const allFiles = await db.query.files.findMany({
    where: and(eq(files.libraryId, libraryId), eq(files.isDir, false)),
  });

  const backlinks: Record<string, unknown>[] = [];

  for (const file of allFiles) {
    const absolutePath = getAbsolutePath(library.path, file.path);
    try {
      const content = await readFile(absolutePath, 'utf-8');

      const wikilinkRegex = /\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]]+))?(?:\|([^\]]+))?\]\]/g;
      const embedRegex = /!\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]]+))?(?:\|([^\]]+))?\]\]/g;
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

      for (const match of content.matchAll(wikilinkRegex)) {
        const target = match[1];
        if (target === filePath || target === filePath.replace(/\.md$/, '')) {
          backlinks.push({
            sourcePath: file.path,
            sourceName: file.name,
            type: 'wikilink',
            target: match[0],
            heading: match[2],
            blockId: match[3],
            alias: match[4],
          });
        }
      }

      for (const match of content.matchAll(embedRegex)) {
        const target = match[1];
        if (target === filePath || target === filePath.replace(/\.md$/, '')) {
          backlinks.push({
            sourcePath: file.path,
            sourceName: file.name,
            type: 'embed',
            target: match[0],
            heading: match[2],
            blockId: match[3],
            alias: match[4],
          });
        }
      }

      for (const match of content.matchAll(linkRegex)) {
        const url = match[2];
        if (url === filePath || url === `./${filePath}`) {
          backlinks.push({
            sourcePath: file.path,
            sourceName: file.name,
            type: 'markdown-link',
            target: match[0],
            text: match[1],
          });
        }
      }
    } catch {
      // Ignore read errors
    }
  }

  return c.json({ success: true, data: { backlinks } });
});

export default editorRoutes;
