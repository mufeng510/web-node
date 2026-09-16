export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, 400, details, false);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details?: unknown) {
    super('AUTHENTICATION_ERROR', message, 401, details, false);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions', details?: unknown) {
    super('AUTHORIZATION_ERROR', message, 403, details, false);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      'NOT_FOUND',
      `${resource}${id ? ` (${id})` : ''} not found`,
      404,
      { resource, id },
      false
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super('CONFLICT', message, 409, details, false);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter?: number) {
    super('RATE_LIMIT_EXCEEDED', message, 429, { retryAfter }, true);
    this.name = 'RateLimitError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(
    public readonly service: string,
    message: string,
    public readonly originalError?: Error,
    retryable = true
  ) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      `${service}: ${message}`,
      502,
      { service, originalError: originalError?.message },
      retryable
    );
    this.name = 'ExternalServiceError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super('DATABASE_ERROR', message, 500, { originalError: originalError?.message }, false);
    this.name = 'DatabaseError';
  }
}

export class FilesystemError extends AppError {
  constructor(
    public readonly operation: string,
    public readonly path: string,
    message: string,
    originalError?: Error
  ) {
    super(
      'FILESYSTEM_ERROR',
      `${operation} failed for ${path}: ${message}`,
      500,
      { operation, path, originalError: originalError?.message },
      false
    );
    this.name = 'FilesystemError';
  }
}

export class PathTraversalError extends AppError {
  constructor(path: string) {
    super('PATH_TRAVERSAL', `Path traversal attempt detected: ${path}`, 400, { path }, false);
    this.name = 'PathTraversalError';
  }
}

export class SymlinkEscapeError extends AppError {
  constructor(path: string, target: string) {
    super(
      'SYMLINK_ESCAPE',
      `Symlink points outside library: ${path} -> ${target}`,
      400,
      { path, target },
      false
    );
    this.name = 'SymlinkEscapeError';
  }
}

export class FileLockError extends AppError {
  constructor(
    public readonly fileId: string,
    public readonly taskId: string
  ) {
    super(
      'FILE_LOCKED',
      `File ${fileId} is locked by task ${taskId}`,
      409,
      { fileId, taskId },
      true
    );
    this.name = 'FileLockError';
  }
}

export class ConcurrencyError extends AppError {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      'CONCURRENCY_CONFLICT',
      `Version conflict: expected ${expectedVersion}, got ${actualVersion}`,
      409,
      { expectedVersion, actualVersion },
      false
    );
    this.name = 'ConcurrencyError';
  }
}

export class EncryptionError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      'ENCRYPTION_ERROR',
      `Encryption ${operation} failed`,
      500,
      { operation, originalError: originalError?.message },
      false
    );
    this.name = 'EncryptionError';
  }
}

export class AiProviderError extends AppError {
  constructor(
    public readonly providerId: string,
    message: string,
    public readonly statusCode: number = 502,
    retryable = true
  ) {
    super(
      'AI_PROVIDER_ERROR',
      `Provider ${providerId}: ${message}`,
      statusCode,
      { providerId },
      retryable
    );
    this.name = 'AiProviderError';
  }
}

export class AiCapabilityError extends AppError {
  constructor(
    public readonly capability: string,
    public readonly model: string
  ) {
    super(
      'AI_CAPABILITY_ERROR',
      `Model ${model} does not support ${capability}`,
      400,
      { capability, model },
      false
    );
    this.name = 'AiCapabilityError';
  }
}

export class AgentTaskError extends AppError {
  constructor(
    public readonly taskId: string,
    message: string,
    public readonly stepIndex?: number,
    originalError?: Error
  ) {
    super(
      'AGENT_TASK_ERROR',
      `Task ${taskId}${stepIndex !== undefined ? ` step ${stepIndex}` : ''}: ${message}`,
      500,
      { taskId, stepIndex, originalError: originalError?.message },
      false
    );
    this.name = 'AgentTaskError';
  }
}

export class MigrationError extends AppError {
  constructor(
    public readonly migrationName: string,
    message: string,
    originalError?: Error
  ) {
    super(
      'MIGRATION_ERROR',
      `Migration ${migrationName} failed: ${message}`,
      500,
      { migrationName, originalError: originalError?.message },
      false
    );
    this.name = 'MigrationError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorResponse(error: unknown, requestId: string) {
  if (isAppError(error)) {
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
        retryable: error.retryable,
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? message : undefined,
      requestId,
      retryable: false,
    },
    meta: {
      requestId,
      timestamp: new Date().toISOString(),
    },
  };
}
