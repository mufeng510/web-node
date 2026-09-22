import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { getEnv } from '../config/env.js';
import * as schema from './schema/index.js';

let dbInstance: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const env = getEnv();
  const dbPath = env.DATABASE_URL.replace('file:', '');
  const resolvedPath = resolve(dbPath);

  const dir = dirname(resolvedPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(resolvedPath, {
    create: true,
    readonly: false,
  });

  // Configure SQLite pragmas for better performance
  sqlite.exec('PRAGMA journal_mode = WAL;');
  sqlite.exec('PRAGMA synchronous = NORMAL;');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec('PRAGMA temp_store = MEMORY;');
  sqlite.exec('PRAGMA cache_size = -32768;');

  dbInstance = drizzle({ client: sqlite, schema, logger: env.NODE_ENV === 'development' });

  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.$client.close();
    dbInstance = null;
  }
}

export { schema };
