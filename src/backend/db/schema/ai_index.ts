import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';
import { files } from './files.js';
import { libraries } from './libraries.js';
import { providers } from './providers.js';

export const aiIndexes = sqliteTable(
  'ai_indexes',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' })
      .unique(),
    providerId: text('provider_id').references(() => providers.id, { onDelete: 'set null' }),
    embedModel: text('embed_model').notNull(),
    status: text('status', { enum: ['idle', 'indexing', 'paused', 'error', 'completed'] })
      .notNull()
      .default('idle'),
    progress: integer('progress').notNull().default(0),
    totalFiles: integer('total_files').notNull().default(0),
    indexedFiles: integer('indexed_files').notNull().default(0),
    totalChunks: integer('total_chunks').notNull().default(0),
    version: integer('version').notNull().default(1),
    lastIndexedAt: integer('last_indexed_at', { mode: 'timestamp' }),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    libraryIdIdx: uniqueIndex('ai_indexes_library_id_idx').on(table.libraryId),
    statusIdx: index('ai_indexes_status_idx').on(table.status),
  })
);

export const aiIndexChunks = sqliteTable(
  'ai_index_chunks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    indexId: text('index_id')
      .notNull()
      .references(() => aiIndexes.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    embedding: text('embedding', { mode: 'json' }),
    metadata: text('metadata', { mode: 'json' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    indexFileChunkIdx: uniqueIndex('ai_index_chunks_index_file_chunk_idx').on(
      table.indexId,
      table.fileId,
      table.chunkIndex
    ),
    indexIdIdx: index('ai_index_chunks_index_id_idx').on(table.indexId),
    fileIdIdx: index('ai_index_chunks_file_id_idx').on(table.fileId),
  })
);

export type AiIndex = typeof aiIndexes.$inferSelect;
export type NewAiIndex = typeof aiIndexes.$inferInsert;
export type AiIndexChunk = typeof aiIndexChunks.$inferSelect;
export type NewAiIndexChunk = typeof aiIndexChunks.$inferInsert;
