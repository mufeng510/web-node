import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';
import { users } from './users.js';

export const libraries = sqliteTable(
  'libraries',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    path: text('path').notNull().unique(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    config: text('config', { mode: 'json' }).notNull(),
    gitConfig: text('git_config', { mode: 'json' }),
    aiIndexConfig: text('ai_index_config', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pathIdx: uniqueIndex('libraries_path_idx').on(table.path),
    ownerIdIdx: index('libraries_owner_id_idx').on(table.ownerId),
  })
);

export const libraryMembers = sqliteTable(
  'library_members',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'admin', 'member'] })
      .notNull()
      .default('member'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryUserIdx: uniqueIndex('library_members_library_user_idx').on(
      table.libraryId,
      table.userId
    ),
    libraryIdIdx: index('library_members_library_id_idx').on(table.libraryId),
    userIdIdx: index('library_members_user_id_idx').on(table.userId),
  })
);

export type Library = typeof libraries.$inferSelect;
export type NewLibrary = typeof libraries.$inferInsert;
export type LibraryMember = typeof libraryMembers.$inferSelect;
export type NewLibraryMember = typeof libraryMembers.$inferInsert;
