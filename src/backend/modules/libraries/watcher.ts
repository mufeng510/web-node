import { EventEmitter } from 'node:events';
import { type FSWatcher, watch } from 'chokidar';
import { eq } from 'drizzle-orm';
import { getEnv } from '../../config/env.js';
import { getDb } from '../../db/index.js';
import { files } from '../../db/schema/files.js';
import { libraries } from '../../db/schema/libraries.js';
import { createId } from '../../utils/id.js';
import { getLibraryRoot } from '../../utils/path.js';

interface FileEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  libraryId: string;
}

const watchers = new Map<string, FSWatcher>();
const eventQueue: FileEvent[] = [];
let flushInterval: ReturnType<typeof setInterval> | null = null;
const emitter = new EventEmitter();

export function startLibraryWatcher(libraryId: string, libraryPath: string) {
  if (watchers.has(libraryId)) return;

  const root = getLibraryRoot(libraryPath);
  const env = getEnv();

  const watcher = watch(root, {
    ignored: ['**/.webnote/**', '**/.git/**', '**/node_modules/**', '**/.DS_Store'],
    persistent: true,
    ignoreInitial: true,
    followSymlinks: false,
    depth: 10,
    awaitWriteFinish: {
      stabilityThreshold: env.FILE_WATCHER_DEBOUNCE_MS,
      pollInterval: 100,
    },
  });

  watcher.on('add', (path) => queueEvent('add', path, libraryId));
  watcher.on('change', (path) => queueEvent('change', path, libraryId));
  watcher.on('unlink', (path) => queueEvent('unlink', path, libraryId));
  watcher.on('addDir', (path) => queueEvent('addDir', path, libraryId));
  watcher.on('unlinkDir', (path) => queueEvent('unlinkDir', path, libraryId));
  watcher.on('error', (error) => console.error(`Watcher error for ${libraryId}:`, error));

  watchers.set(libraryId, watcher);

  if (!flushInterval) {
    flushInterval = setInterval(flushEvents, 1000);
  }

  console.log(`[Watcher] Started for library ${libraryId}`);
}

export function stopLibraryWatcher(libraryId: string) {
  const watcher = watchers.get(libraryId);
  if (watcher) {
    watcher.close();
    watchers.delete(libraryId);
    console.log(`[Watcher] Stopped for library ${libraryId}`);
  }
}

export function stopAllWatchers() {
  for (const [_id, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}

function queueEvent(type: FileEvent['type'], path: string, libraryId: string) {
  const relativePath = path
    .replace(getLibraryRoot(libraryPathFromId(libraryId)), '')
    .replace(/^\//, '');
  if (relativePath.startsWith('.webnote/') || relativePath.startsWith('.git/')) return;

  eventQueue.push({ type, path: relativePath, libraryId });
}

async function flushEvents() {
  if (eventQueue.length === 0) return;

  const events = eventQueue.splice(0, eventQueue.length);
  const byLibrary = new Map<string, FileEvent[]>();

  for (const event of events) {
    if (!byLibrary.has(event.libraryId)) {
      byLibrary.set(event.libraryId, []);
    }
    byLibrary.get(event.libraryId)?.push(event);
  }

  for (const [libraryId, libEvents] of byLibrary) {
    try {
      await processLibraryEvents(libraryId, libEvents);
      emitter.emit('library:events', libraryId, libEvents);
    } catch (error) {
      console.error(`[Watcher] Failed to process events for ${libraryId}:`, error);
    }
  }
}

async function processLibraryEvents(libraryId: string, events: FileEvent[]) {
  const _db = getDb();

  for (const event of events) {
    switch (event.type) {
      case 'add':
      case 'change':
        await handleFileChange(libraryId, event.path);
        break;
      case 'unlink':
        await handleFileDelete(libraryId, event.path);
        break;
      case 'addDir':
        await handleDirAdd(libraryId, event.path);
        break;
      case 'unlinkDir':
        await handleDirDelete(libraryId, event.path);
        break;
    }
  }
}

async function handleFileChange(libraryId: string, relativePath: string) {
  const db = getDb();
  const library = await db.query.libraries.findFirst({ where: eq(libraries.id, libraryId) });
  if (!library) return;

  const { stat } = await import('node:fs/promises');
  const fullPath = join(getLibraryRoot(library.path), relativePath);

  try {
    const stats = await stat(fullPath);
    const existing = await db.query.files.findFirst({
      where: eq(files.libraryId, libraryId),
    });

    const fileId = createId();
    await db
      .insert(files)
      .values({
        id: fileId,
        libraryId,
        path: relativePath,
        name: relativePath.split('/').pop() || '',
        isDir: false,
        size: stats.size,
        mimeType: getMimeType(relativePath),
        mtime: stats.mtime,
        version: (existing?.version || 0) + 1,
      })
      .onConflictDoUpdate({
        target: [files.libraryId, files.path],
        set: { size: stats.size, mtime: stats.mtime, version: { increment: 1 } },
      });
  } catch (error) {
    console.error(`[Watcher] Failed to update file ${relativePath}:`, error);
  }
}

async function handleFileDelete(libraryId: string, relativePath: string) {
  const db = getDb();
  await db.delete(files).where(eq(files.libraryId, libraryId)).where(eq(files.path, relativePath));
}

async function handleDirAdd(libraryId: string, relativePath: string) {
  const db = getDb();
  const fileId = createId();
  await db
    .insert(files)
    .values({
      id: fileId,
      libraryId,
      path: relativePath,
      name: relativePath.split('/').pop() || '',
      isDir: true,
      size: 0,
      mtime: new Date(),
    })
    .onConflictDoNothing();
}

async function handleDirDelete(libraryId: string, relativePath: string) {
  const db = getDb();
  await db.delete(files).where(eq(files.libraryId, libraryId)).where(eq(files.path, relativePath));
}

function libraryPathFromId(_libraryId: string): string {
  return '';
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    zip: 'application/zip',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export function onLibraryEvents(callback: (libraryId: string, events: FileEvent[]) => void) {
  emitter.on('library:events', callback);
}

export function offLibraryEvents(callback: (libraryId: string, events: FileEvent[]) => void) {
  emitter.off('library:events', callback);
}
