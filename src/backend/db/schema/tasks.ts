import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createId } from '../../utils/id.js';

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    conversationId: text('conversation_id').references(() => conversations.id, {
      onDelete: 'set null',
    }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    libraryId: text('library_id')
      .notNull()
      .references(() => libraries.id, { onDelete: 'cascade' }),
    goal: text('goal').notNull(),
    plan: text('plan', { mode: 'json' }),
    status: text('status', {
      enum: [
        'pending',
        'running',
        'waiting',
        'paused',
        'completed',
        'failed',
        'cancelled',
        'interrupted',
      ],
    })
      .notNull()
      .default('pending'),
    currentStep: integer('current_step').notNull().default(0),
    totalSteps: integer('total_steps').notNull().default(0),
    providerId: text('provider_id').references(() => providers.id, { onDelete: 'set null' }),
    model: text('model'),
    parameters: text('parameters', { mode: 'json' }),
    lockFiles: text('lock_files', { mode: 'json' }).$type<string[]>().default([]),
    result: text('result', { mode: 'json' }),
    error: text('error'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('tasks_user_id_idx').on(table.userId),
    libraryIdIdx: index('tasks_library_id_idx').on(table.libraryId),
    conversationIdIdx: index('tasks_conversation_id_idx').on(table.conversationId),
    statusIdx: index('tasks_status_idx').on(table.status),
    createdAtIdx: index('tasks_created_at_idx').on(table.createdAt),
  })
);

export const taskSteps = sqliteTable(
  'task_steps',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    tool: text('tool').notNull(),
    args: text('args', { mode: 'json' }),
    result: text('result', { mode: 'json' }),
    status: text('status', { enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    startedAt: integer('started_at', { mode: 'timestamp' }),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    taskStepIdx: uniqueIndex('task_steps_task_step_idx').on(table.taskId, table.stepIndex),
    taskIdIdx: index('task_steps_task_id_idx').on(table.taskId),
  })
);

export const taskRollbacks = sqliteTable(
  'task_rollbacks',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    fileId: text('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    beforeHash: text('before_hash'),
    afterHash: text('after_hash'),
    beforeVersion: integer('before_version').notNull(),
    afterVersion: integer('after_version').notNull(),
    beforeContent: text('before_content'),
    afterContent: text('after_content'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    taskIdIdx: index('task_rollbacks_task_id_idx').on(table.taskId),
    fileIdIdx: index('task_rollbacks_file_id_idx').on(table.fileId),
  })
);

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
});

export const libraries = sqliteTable('libraries', {
  id: text('id').primaryKey(),
});

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
});

export const files = sqliteTable('files', {
  id: text('id').primaryKey(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskStep = typeof taskSteps.$inferSelect;
export type NewTaskStep = typeof taskSteps.$inferInsert;
export type TaskRollback = typeof taskRollbacks.$inferSelect;
export type NewTaskRollback = typeof taskRollbacks.$inferInsert;
