#!/usr/bin/env bun

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

const types = `
// Auto-generated types from OpenAPI spec
export interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
}

export interface Library {
  id: string;
  name: string;
  path: string;
  ownerId: string;
  config: LibraryConfig;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryConfig {
  name: string;
  path: string;
  ownerId: string;
  git: GitConfig;
  aiIndex: AiIndexConfig;
  attachments: AttachmentsConfig;
  visibility: VisibilityConfig;
  readOnly: boolean;
}

export interface GitConfig {
  enabled: boolean;
  remoteUrl: string;
  branch: string;
  authType: 'none' | 'https' | 'ssh';
  credentials?: string;
  autoBackup: boolean;
  autoBackupSchedule: string;
}

export interface AiIndexConfig {
  enabled: boolean;
  providerId: string;
  embedModel: string;
  chunkSize: number;
  chunkOverlap: number;
  excludePatterns: string[];
}

export interface AttachmentsConfig {
  defaultDir: string;
  allowedTypes: string[];
}

export interface VisibilityConfig {
  showHiddenFiles: boolean;
  showObsidianDir: boolean;
  showGitDir: boolean;
}

export interface File {
  id: string;
  libraryId: string;
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  mimeType?: string;
  mtime: string;
  frontmatter?: Record<string, unknown>;
}

export interface Conversation {
  id: string;
  libraryId: string;
  userId: string;
  title: string;
  currentNoteId?: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: Record<string, unknown>;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  fileId: string;
  filePath: string;
  snippet: string;
  lineStart?: number;
  lineEnd?: number;
}

export interface Task {
  id: string;
  conversationId?: string;
  userId: string;
  libraryId: string;
  goal: string;
  plan?: TaskPlan;
  status: 'pending' | 'running' | 'waiting' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  currentStep: number;
  totalSteps: number;
  providerId?: string;
  model?: string;
  parameters?: TaskParameters;
  lockFiles: string[];
  result?: TaskResult;
  error?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface TaskPlan {
  steps: TaskStepPlan[];
}

export interface TaskStepPlan {
  tool: string;
  args: Record<string, unknown>;
  description: string;
}

export interface TaskParameters {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

export interface TaskResult {
  filesModified: string[];
  filesCreated: string[];
  filesDeleted: string[];
  gitCommits: string[];
  summary: string;
}

export interface Provider {
  id: string;
  name: string;
  type: 'openai' | 'ollama' | 'lm-studio' | 'custom';
  baseUrl: string;
  chatModel: string;
  embedModel?: string;
  rerankModel?: string;
  capabilities: string[];
  isDefault: boolean;
  discoveredModels: string[];
}

export interface McpToken {
  id: string;
  name: string;
  libraryId: string;
  permissions: {
    read: boolean;
    write: boolean;
    git: boolean;
  };
  expiresAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

export interface SearchResult {
  items: File[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  retryable: boolean;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  duration?: number;
}
`;

mkdirSync(resolve(ROOT, 'src/frontend/src/types'), { recursive: true });
writeFileSync(resolve(ROOT, 'src/frontend/src/types/api.ts'), types);
console.log('✅ Types generated at src/frontend/src/types/api.ts');
