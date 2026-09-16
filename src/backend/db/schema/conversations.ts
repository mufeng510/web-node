import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';

export const conversations = sqliteTable(
  'conversations',
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
    title: text('title').notNull(),
    currentNoteId: text('current_note_id'),
    messageCount: integer('message_count').notNull().default(0),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryUserIdx: index('conversations_library_user_idx').on(table.libraryId, table.userId),
    userIdIdx: index('conversations_user_id_idx').on(table.userId),
    updatedAtIdx: index('conversations_updated_at_idx').on(table.updatedAt),
  })
);

export const messages = sqliteTable(
  'messages',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    conversationId: text('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
    content: text('content').notNull(),
    metadata: text('metadata', { mode: 'json' }),
    citations: text('citations', { mode: 'json' }),
    tokenCount: integer('token_count'),
    model: text('model'),
    providerId: text('provider_id'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    conversationIdIdx: index('messages_conversation_id_idx').on(table.conversationId),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
  })
);

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
