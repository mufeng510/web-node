import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';
import { libraries } from './libraries.js';

export const gitConfigs = sqliteTable(
  'git_configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' })
      .unique(),
    remoteUrl: text('remote_url'),
    branch: text('branch').notNull().default('main'),
    authType: text('auth_type', { enum: ['none', 'https', 'ssh'] })
      .notNull()
      .default('none'),
    credentials: text('credentials'),
    autoBackup: integer('auto_backup', { mode: 'boolean' }).notNull().default(true),
    autoBackupSchedule: text('auto_backup_schedule').default('0 * * * *'),
    lastBackupAt: integer('last_backup_at', { mode: 'timestamp' }),
    lastCommitHash: text('last_commit_hash'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryIdIdx: uniqueIndex('git_configs_library_id_idx').on(table.libraryId),
  })
);

export const gitCommits = sqliteTable(
  'git_commits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    hash: text('hash').notNull(),
    shortHash: text('short_hash').notNull(),
    message: text('message').notNull(),
    authorName: text('author_name').notNull(),
    authorEmail: text('author_email').notNull(),
    authorDate: integer('author_date', { mode: 'timestamp' }).notNull(),
    committerName: text('committer_name'),
    committerEmail: text('committer_email'),
    committerDate: integer('committer_date', { mode: 'timestamp' }),
    parents: text('parents', { mode: 'json' }).$type<string[]>().default([]),
    files: text('files', { mode: 'json' }).$type<string[]>().default([]),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryIdIdx: index('git_commits_library_id_idx').on(table.libraryId),
    hashIdx: uniqueIndex('git_commits_hash_idx').on(table.hash),
    authorDateIdx: index('git_commits_author_date_idx').on(table.authorDate),
  })
);

export type GitConfig = typeof gitConfigs.$inferSelect;
export type NewGitConfig = typeof gitConfigs.$inferInsert;
export type GitCommit = typeof gitCommits.$inferSelect;
export type NewGitCommit = typeof gitCommits.$inferInsert;
