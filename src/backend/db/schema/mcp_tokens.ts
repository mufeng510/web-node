import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';

export const mcpTokens = sqliteTable(
  'mcp_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    permissions: text('permissions', { mode: 'json' })
      .$type<{
        read: boolean;
        write: boolean;
        git: boolean;
      }>()
      .notNull()
      .default({ read: true, write: false, git: false }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp' }),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tokenHashIdx: uniqueIndex('mcp_tokens_token_hash_idx').on(table.tokenHash),
    libraryIdIdx: index('mcp_tokens_library_id_idx').on(table.libraryId),
  })
);

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
});

export type McpToken = typeof mcpTokens.$inferSelect;
export type NewMcpToken = typeof mcpTokens.$inferInsert;
