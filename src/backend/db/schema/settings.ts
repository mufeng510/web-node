import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable(
  'settings',
  {
    key: text('key').primaryKey(),
    value: text('value', { mode: 'json' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    keyIdx: uniqueIndex('settings_key_idx').on(table.key),
  })
);

export const dbBackups = sqliteTable(
  'db_backups',
  {
    id: text('id').primaryKey(),
    path: text('path').notNull(),
    size: integer('size').notNull(),
    status: text('status', { enum: ['pending', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    createdAtIdx: index('db_backups_created_at_idx').on(table.createdAt),
  })
);

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type DbBackup = typeof dbBackups.$inferSelect;
export type NewDbBackup = typeof dbBackups.$inferInsert;
