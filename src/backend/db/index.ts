import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
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
    fileMustExist: false,
    readonly: false,
    timeout: 30000,
  });

  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('temp_store = MEMORY');
  sqlite.pragma('cache_size = -32768');

  dbInstance = drizzle(sqlite, { schema, logger: env.NODE_ENV === 'development' });

  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.$client.close();
    dbInstance = null;
  }
}

export { schema };
