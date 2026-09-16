import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';
import { libraries } from './libraries.js';

export const files = sqliteTable(
  'files',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references(() => files.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    name: text('name').notNull(),
    isDir: integer('is_dir', { mode: 'boolean' }).notNull().default(false),
    size: integer('size').notNull().default(0),
    mimeType: text('mime_type'),
    hash: text('hash'),
    version: integer('version').notNull().default(0),
    frontmatter: text('frontmatter', { mode: 'json' }),
    mtime: integer('mtime', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryPathIdx: uniqueIndex('files_library_path_idx').on(table.libraryId, table.path),
    libraryParentIdx: index('files_library_parent_idx').on(table.libraryId, table.parentId),
    libraryNameIdx: index('files_library_name_idx').on(table.libraryId, table.name),
    hashIdx: index('files_hash_idx').on(table.hash),
  })
);

export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
