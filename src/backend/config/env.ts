import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),

  DATA_ROOT: z.string().default('/data'),
  APP_DATA_ROOT: z.string().default('/app-data'),

  MASTER_ENCRYPTION_KEY: z.string().min(32, 'Master encryption key must be at least 32 characters'),

  DATABASE_URL: z
    .string()
    .url()
    .or(z.string().startsWith('file:'))
    .default('file:./app-data/webnote.db'),

  TZ: z.string().default('UTC'),

  SESSION_SECRET: z.string().min(32).optional(),
  SESSION_MAX_AGE_DAYS: z.coerce.number().int().positive().default(30),
  SESSION_CLEANUP_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_RETENTION_DAYS: z.coerce.number().int().positive().default(30),

  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),

  DB_BACKUP_ENABLED: z.coerce.boolean().default(true),
  DB_BACKUP_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  DB_BACKUP_RETENTION_COUNT: z.coerce.number().int().positive().default(7),

  FILE_WATCHER_DEBOUNCE_MS: z.coerce.number().int().positive().default(300),
  FILE_WATCHER_MAX_EVENTS: z.coerce.number().int().positive().default(1000),

  SEARCH_INDEX_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  SEARCH_INDEX_DEBOUNCE_MS: z.coerce.number().int().positive().default(1000),

  AI_INDEX_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  AI_INDEX_CONCURRENCY: z.coerce.number().int().positive().default(2),
  AI_INDEX_CHUNK_SIZE: z.coerce.number().int().positive().default(512),
  AI_INDEX_CHUNK_OVERLAP: z.coerce.number().int().positive().default(50),

  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  AI_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),

  AGENT_MAX_STEPS: z.coerce.number().int().positive().default(50),
  AGENT_TASK_TIMEOUT_MS: z.coerce.number().int().positive().default(600000),
  AGENT_CONCURRENCY: z.coerce.number().int().positive().default(3),

  MCP_TOKEN_DEFAULT_EXPIRY_DAYS: z.coerce.number().int().positive().default(365),

  GIT_AUTO_BACKUP_ENABLED: z.coerce.boolean().default(true),
  GIT_AUTO_BACKUP_DEFAULT_SCHEDULE: z.string().default('0 * * * *'),

  CORS_ORIGIN: z.string().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  FRONTEND_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function getEnvVar(key: string): string | undefined {
  return process.env[key];
}

export function getEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const result = envSchema.safeParse({
    NODE_ENV: getEnvVar('NODE_ENV'),
    PORT: getEnvVar('PORT'),
    DATA_ROOT: getEnvVar('DATA_ROOT'),
    APP_DATA_ROOT: getEnvVar('APP_DATA_ROOT'),
    MASTER_ENCRYPTION_KEY: getEnvVar('MASTER_ENCRYPTION_KEY'),
    DATABASE_URL: getEnvVar('DATABASE_URL'),
    TZ: getEnvVar('TZ'),
    SESSION_SECRET: getEnvVar('SESSION_SECRET'),
    SESSION_MAX_AGE_DAYS: getEnvVar('SESSION_MAX_AGE_DAYS'),
    SESSION_CLEANUP_INTERVAL_HOURS: getEnvVar('SESSION_CLEANUP_INTERVAL_HOURS'),
    LOG_LEVEL: getEnvVar('LOG_LEVEL'),
    LOG_RETENTION_DAYS: getEnvVar('LOG_RETENTION_DAYS'),
    AUDIT_RETENTION_DAYS: getEnvVar('AUDIT_RETENTION_DAYS'),
    DB_BACKUP_ENABLED: getEnvVar('DB_BACKUP_ENABLED'),
    DB_BACKUP_INTERVAL_HOURS: getEnvVar('DB_BACKUP_INTERVAL_HOURS'),
    DB_BACKUP_RETENTION_COUNT: getEnvVar('DB_BACKUP_RETENTION_COUNT'),
    FILE_WATCHER_DEBOUNCE_MS: getEnvVar('FILE_WATCHER_DEBOUNCE_MS'),
    FILE_WATCHER_MAX_EVENTS: getEnvVar('FILE_WATCHER_MAX_EVENTS'),
    SEARCH_INDEX_BATCH_SIZE: getEnvVar('SEARCH_INDEX_BATCH_SIZE'),
    SEARCH_INDEX_DEBOUNCE_MS: getEnvVar('SEARCH_INDEX_DEBOUNCE_MS'),
    AI_INDEX_BATCH_SIZE: getEnvVar('AI_INDEX_BATCH_SIZE'),
    AI_INDEX_CONCURRENCY: getEnvVar('AI_INDEX_CONCURRENCY'),
    AI_INDEX_CHUNK_SIZE: getEnvVar('AI_INDEX_CHUNK_SIZE'),
    AI_INDEX_CHUNK_OVERLAP: getEnvVar('AI_INDEX_CHUNK_OVERLAP'),
    AI_REQUEST_TIMEOUT_MS: getEnvVar('AI_REQUEST_TIMEOUT_MS'),
    AI_STREAM_TIMEOUT_MS: getEnvVar('AI_STREAM_TIMEOUT_MS'),
    AGENT_MAX_STEPS: getEnvVar('AGENT_MAX_STEPS'),
    AGENT_TASK_TIMEOUT_MS: getEnvVar('AGENT_TASK_TIMEOUT_MS'),
    AGENT_CONCURRENCY: getEnvVar('AGENT_CONCURRENCY'),
    MCP_TOKEN_DEFAULT_EXPIRY_DAYS: getEnvVar('MCP_TOKEN_DEFAULT_EXPIRY_DAYS'),
    GIT_AUTO_BACKUP_ENABLED: getEnvVar('GIT_AUTO_BACKUP_ENABLED'),
    GIT_AUTO_BACKUP_DEFAULT_SCHEDULE: getEnvVar('GIT_AUTO_BACKUP_DEFAULT_SCHEDULE'),
    CORS_ORIGIN: getEnvVar('CORS_ORIGIN'),
    RATE_LIMIT_WINDOW_MS: getEnvVar('RATE_LIMIT_WINDOW_MS'),
    RATE_LIMIT_MAX_REQUESTS: getEnvVar('RATE_LIMIT_MAX_REQUESTS'),
    FRONTEND_URL: getEnvVar('FRONTEND_URL'),
  });

  if (!result.success) {
    console.error('❌ Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function validateEnv(): Env {
  return getEnv();
}
