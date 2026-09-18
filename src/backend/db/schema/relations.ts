import { relations } from 'drizzle-orm';
import { aiIndexChunks, aiIndexes } from './ai_index.js';
import { conversations, messages } from './conversations.js';
import { files } from './files.js';
import { gitCommits, gitConfigs } from './git.js';
import { libraries, libraryMembers } from './libraries.js';
import { mcpTokens } from './mcp_tokens.js';
import { notifications } from './notifications.js';
import { providers } from './providers.js';
import { searchIndex } from './search.js';
import { sessions } from './sessions.js';
import { taskRollbacks, taskSteps, tasks } from './tasks.js';
import { users } from './users.js';

// --- Users ---
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  ownedLibraries: many(libraries),
  libraryMemberships: many(libraryMembers),
  conversations: many(conversations),
  tasks: many(tasks),
  notifications: many(notifications),
}));

// --- Sessions ---
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// --- Libraries ---
export const librariesRelations = relations(libraries, ({ one, many }) => ({
  owner: one(users, {
    fields: [libraries.ownerId],
    references: [users.id],
  }),
  members: many(libraryMembers),
  files: many(files),
  searchEntries: many(searchIndex),
  aiIndex: one(aiIndexes),
  gitConfig: one(gitConfigs),
  gitCommits: many(gitCommits),
  conversations: many(conversations),
  tasks: many(tasks),
  mcpTokens: many(mcpTokens),
}));

// --- Library Members ---
export const libraryMembersRelations = relations(libraryMembers, ({ one }) => ({
  library: one(libraries, {
    fields: [libraryMembers.libraryId],
    references: [libraries.id],
  }),
  user: one(users, {
    fields: [libraryMembers.userId],
    references: [users.id],
  }),
}));

// --- Files ---
export const filesRelations = relations(files, ({ one, many }) => ({
  library: one(libraries, {
    fields: [files.libraryId],
    references: [libraries.id],
  }),
  parent: one(files, {
    fields: [files.parentId],
    references: [files.id],
    relationName: 'fileTree',
  }),
  children: many(files, { relationName: 'fileTree' }),
  searchEntries: many(searchIndex),
  aiChunks: many(aiIndexChunks),
  rollbacks: many(taskRollbacks),
}));

// --- Search Index ---
export const searchIndexRelations = relations(searchIndex, ({ one }) => ({
  library: one(libraries, {
    fields: [searchIndex.libraryId],
    references: [libraries.id],
  }),
  file: one(files, {
    fields: [searchIndex.fileId],
    references: [files.id],
  }),
}));

// --- AI Indexes ---
export const aiIndexesRelations = relations(aiIndexes, ({ one, many }) => ({
  library: one(libraries, {
    fields: [aiIndexes.libraryId],
    references: [libraries.id],
  }),
  provider: one(providers, {
    fields: [aiIndexes.providerId],
    references: [providers.id],
  }),
  chunks: many(aiIndexChunks),
}));

// --- AI Index Chunks ---
export const aiIndexChunksRelations = relations(aiIndexChunks, ({ one }) => ({
  index: one(aiIndexes, {
    fields: [aiIndexChunks.indexId],
    references: [aiIndexes.id],
  }),
  file: one(files, {
    fields: [aiIndexChunks.fileId],
    references: [files.id],
  }),
}));

// --- Providers ---
export const providersRelations = relations(providers, ({ many }) => ({
  aiIndexes: many(aiIndexes),
}));

// --- Conversations ---
export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  library: one(libraries, {
    fields: [conversations.libraryId],
    references: [libraries.id],
  }),
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  messages: many(messages),
}));

// --- Messages ---
export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));

// --- Tasks ---
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  conversation: one(conversations, {
    fields: [tasks.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
  library: one(libraries, {
    fields: [tasks.libraryId],
    references: [libraries.id],
  }),
  provider: one(providers, {
    fields: [tasks.providerId],
    references: [providers.id],
  }),
  steps: many(taskSteps),
  rollbacks: many(taskRollbacks),
}));

// --- Task Steps ---
export const taskStepsRelations = relations(taskSteps, ({ one }) => ({
  task: one(tasks, {
    fields: [taskSteps.taskId],
    references: [tasks.id],
  }),
}));

// --- Task Rollbacks ---
export const taskRollbacksRelations = relations(taskRollbacks, ({ one }) => ({
  task: one(tasks, {
    fields: [taskRollbacks.taskId],
    references: [tasks.id],
  }),
  file: one(files, {
    fields: [taskRollbacks.fileId],
    references: [files.id],
  }),
}));

// --- Git Configs ---
export const gitConfigsRelations = relations(gitConfigs, ({ one }) => ({
  library: one(libraries, {
    fields: [gitConfigs.libraryId],
    references: [libraries.id],
  }),
}));

// --- Git Commits ---
export const gitCommitsRelations = relations(gitCommits, ({ one }) => ({
  library: one(libraries, {
    fields: [gitCommits.libraryId],
    references: [libraries.id],
  }),
}));

// --- MCP Tokens ---
export const mcpTokensRelations = relations(mcpTokens, ({ one }) => ({
  library: one(libraries, {
    fields: [mcpTokens.libraryId],
    references: [libraries.id],
  }),
}));

// --- Notifications ---
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));
