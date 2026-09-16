import { z } from 'zod';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const SetupWizardSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
    baseUrl: z.string().url().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// User schemas
export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['admin', 'user']).default('user'),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(['admin', 'user']).optional(),
  isActive: z.boolean().optional(),
});

// Library schemas
export const CreateLibrarySchema = z.object({
  name: z.string().min(1).max(255),
  path: z.string().min(1),
  git: z
    .object({
      enabled: z.boolean().default(false),
      remoteUrl: z.string().url().optional().or(z.literal('')),
      branch: z.string().default('main'),
      authType: z.enum(['none', 'https', 'ssh']).default('none'),
      credentials: z.string().optional(),
      autoBackup: z.boolean().default(true),
      autoBackupSchedule: z.string().default('0 * * * *'),
    })
    .optional(),
  aiIndex: z
    .object({
      enabled: z.boolean().default(true),
      providerId: z.string().uuid().optional(),
      embedModel: z.string().optional(),
      chunkSize: z.number().int().positive().default(512),
      chunkOverlap: z.number().int().nonnegative().default(50),
      excludePatterns: z.array(z.string()).default(['.obsidian/**', '.git/**', '.webnote/**']),
    })
    .optional(),
  attachments: z
    .object({
      defaultDir: z.string().default('attachments'),
      allowedTypes: z
        .array(z.string())
        .default(['image/*', 'application/pdf', 'application/zip', 'audio/*', 'video/*']),
    })
    .optional(),
  visibility: z
    .object({
      showHiddenFiles: z.boolean().default(false),
      showObsidianDir: z.boolean().default(false),
      showGitDir: z.boolean().default(false),
    })
    .optional(),
  readOnly: z.boolean().default(false),
});

export const UpdateLibrarySchema = CreateLibrarySchema.partial().omit({ path: true });

export const LibraryShareSchema = z.object({
  userId: z.string().uuid(),
  permission: z.enum(['read', 'write', 'admin']).default('write'),
});

export const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid(),
});

// File schemas
export const CreateFileSchema = z.object({
  path: z.string().min(1),
  content: z.string().optional(),
  isDir: z.boolean().default(false),
});

export const UpdateFileSchema = z.object({
  content: z.string().optional(),
  frontmatter: z.record(z.unknown()).optional(),
  expectedHash: z.string().optional(),
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const MoveFileSchema = z.object({
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  overwrite: z.boolean().default(false),
});

export const BatchMoveFilesSchema = z.object({
  moves: z
    .array(
      z.object({
        sourcePath: z.string().min(1),
        targetPath: z.string().min(1),
      })
    )
    .min(1)
    .max(100),
});

export const RenameFileSchema = z.object({
  path: z.string().min(1),
  newName: z.string().min(1).max(255),
  updateReferences: z.boolean().default(true),
});

export const BatchRenameFilesSchema = z.object({
  renames: z
    .array(
      z.object({
        path: z.string().min(1),
        newName: z.string().min(1).max(255),
      })
    )
    .min(1)
    .max(100),
});

export const UploadAttachmentSchema = z.object({
  libraryId: z.string().uuid(),
  targetDir: z.string().optional(),
  overwrite: z.boolean().default(false),
});

// Search schemas
export const SearchQuerySchema = z.object({
  q: z.string().min(1),
  libraryId: z.string().uuid().optional(),
  scope: z.enum(['all', 'filename', 'content', 'frontmatter', 'tags', 'wikilinks']).default('all'),
  type: z.enum(['exact', 'fuzzy']).default('fuzzy'),
  path: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

// Editor schemas
export const WikiLinkSchema = z.object({
  target: z.string().min(1),
  alias: z.string().optional(),
  heading: z.string().optional(),
  blockId: z.string().optional(),
  embed: z.boolean().default(false),
});

export const RenameReferenceSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
  updateWikilinks: z.boolean().default(true),
  updateMarkdownLinks: z.boolean().default(true),
  updateEmbeds: z.boolean().default(true),
});

// Git schemas
export const GitCommitSchema = z.object({
  message: z.string().min(1).max(1000),
  author: z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
    })
    .optional(),
  files: z.array(z.string()).optional(),
});

export const GitPushSchema = z.object({
  remote: z.string().default('origin'),
  branch: z.string().optional(),
  force: z.boolean().default(false),
});

export const GitPullSchema = z.object({
  remote: z.string().default('origin'),
  branch: z.string().optional(),
  rebase: z.boolean().default(false),
});

export const GitRestoreSchema = z.object({
  commitHash: z.string().min(1),
  paths: z.array(z.string()).min(1),
  strategy: z.enum(['checkout', 'revert']).default('checkout'),
});

// AI Provider schemas
export const CreateProviderSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['openai', 'ollama', 'lm-studio', 'custom']),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  chatModel: z.string().min(1),
  embedModel: z.string().optional(),
  rerankModel: z.string().optional(),
  customHeaders: z.record(z.string()).optional(),
  isDefault: z.boolean().default(false),
});

export const UpdateProviderSchema = CreateProviderSchema.partial().omit({ type: true });

export const TestProviderSchema = z.object({
  providerId: z.string().uuid().optional(),
  config: CreateProviderSchema.optional(),
});

// Conversation schemas
export const CreateConversationSchema = z.object({
  libraryId: z.string().uuid(),
  title: z.string().max(255).optional(),
  initialMessage: z.string().optional(),
});

export const UpdateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  currentNoteId: z.string().optional(),
});

export const SendMessageSchema = z.object({
  content: z.string().min(1),
  role: z.enum(['user', 'assistant']).default('user'),
  selectedText: z.string().optional(),
  noteId: z.string().optional(),
  contextFiles: z.array(z.string()).optional(),
});

// Agent schemas
export const CreateAgentTaskSchema = z.object({
  conversationId: z.string().uuid(),
  goal: z.string().min(1).max(5000),
  libraryId: z.string().uuid(),
  providerId: z.string().uuid().optional(),
  model: z.string().optional(),
  parameters: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional(),
      maxTokens: z.number().int().positive().optional(),
    })
    .optional(),
  permissions: z
    .object({
      read: z.enum(['allow', 'ask', 'deny']).default('allow'),
      search: z.enum(['allow', 'ask', 'deny']).default('allow'),
      create: z.enum(['allow', 'ask', 'deny']).default('ask'),
      edit: z.enum(['allow', 'ask', 'deny']).default('ask'),
      delete: z.enum(['allow', 'ask', 'deny']).default('ask'),
      gitCommit: z.enum(['allow', 'ask', 'deny']).default('ask'),
      gitPush: z.enum(['allow', 'ask', 'deny']).default('ask'),
      gitPull: z.enum(['allow', 'ask', 'deny']).default('ask'),
    })
    .optional(),
});

export const AgentTaskActionSchema = z.object({
  taskId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'cancel', 'rerun']),
  stepIndex: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});

// MCP schemas
export const CreateMcpTokenSchema = z.object({
  name: z.string().min(1).max(100),
  libraryId: z.string().uuid(),
  permissions: z.object({
    read: z.boolean().default(true),
    write: z.boolean().default(false),
    git: z.boolean().default(false),
  }),
  expiresAt: z.string().datetime().optional(),
});

// Settings schemas
export const UpdateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().int().positive().optional(),
  language: z.enum(['en', 'zh-CN']).optional(),
  autosaveDebounceMs: z.number().int().positive().optional(),
  maxFileSizeMb: z.number().int().positive().optional(),
  trashRetentionDays: z.number().int().nonnegative().optional(),
  sessionMaxAgeDays: z.number().int().positive().optional(),
});

export const UpdateAiSettingsSchema = z.object({
  defaultProviderId: z.string().uuid().optional(),
  defaultChatModel: z.string().optional(),
  defaultEmbedModel: z.string().optional(),
  defaultTemperature: z.number().min(0).max(2).optional(),
  defaultTopP: z.number().min(0).max(1).optional(),
  requestTimeoutMs: z.number().int().positive().optional(),
});

// Webhook schemas
export const CreateWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  secret: z.string().min(16).optional(),
});

export const UpdateWebhookSchema = CreateWebhookSchema.partial();

// Pagination
export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

// Common response types
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
        requestId: z.string().uuid(),
        retryable: z.boolean().default(false),
      })
      .optional(),
    meta: z
      .object({
        requestId: z.string().uuid(),
        timestamp: z.string().datetime(),
        duration: z.number().optional(),
      })
      .optional(),
  });

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  ApiResponseSchema(
    z.object({
      items: z.array(itemSchema),
      nextCursor: z.string().optional(),
      hasMore: z.boolean(),
    })
  );
