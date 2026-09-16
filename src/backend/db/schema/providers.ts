import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';

export const providers = sqliteTable(
  'providers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text('name').notNull(),
    type: text('type', { enum: ['openai', 'ollama', 'lm-studio', 'custom'] }).notNull(),
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key'),
    chatModel: text('chat_model').notNull(),
    embedModel: text('embed_model'),
    rerankModel: text('rerank_model'),
    customHeaders: text('custom_headers', { mode: 'json' }),
    capabilities: text('capabilities', { mode: 'json' }).$type<string[]>().default([]),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    discoveredModels: text('discovered_models', { mode: 'json' }).$type<string[]>().default([]),
    lastTestedAt: integer('last_tested_at', { mode: 'timestamp' }),
    lastTestResult: text('last_test_result'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameIdx: index('providers_name_idx').on(table.name),
    isDefaultIdx: index('providers_is_default_idx').on(table.isDefault),
  })
);

export type Provider = typeof providers.$inferSelect;
export type NewProvider = typeof providers.$inferInsert;
