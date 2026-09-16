import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';

export const searchIndex = sqliteTable(
  'search_index',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    name: text('name').notNull(),
    content: text('content'),
    frontmatter: text('frontmatter', { mode: 'json' }),
    tags: text('tags', { mode: 'json' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryIdIdx: index('search_index_library_id_idx').on(table.libraryId),
    fileIdIdx: index('search_index_file_id_idx').on(table.fileId),
    nameIdx: index('search_index_name_idx').on(table.name),
  })
);

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
});

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
});

export type SearchIndex = typeof searchIndex.$inferSelect;
export type NewSearchIndex = typeof searchIndex.$inferInsert;
