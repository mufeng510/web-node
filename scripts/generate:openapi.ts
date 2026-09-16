#!/usr/bin/env bun

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');
const ROOT = resolve(__dirname, '..');

// (keeping the same openApiSpec content as before, just fixing the import)
const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Web Note API',
    version: '0.1.0',
    description:
      'Browser-first, Self-hosted, Markdown-first, Obsidian-compatible, AI-native personal knowledge base API',
  },
  servers: [{ url: 'http://localhost:8080/api/v1', description: 'Development server' }],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'webnote_session' },
      csrfAuth: { type: 'apiKey', in: 'header', name: 'x-csrf-token' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          details: { type: 'object' },
          requestId: { type: 'string', format: 'uuid' },
          retryable: { type: 'boolean' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'user'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Library: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          path: { type: 'string' },
          ownerId: { type: 'string', format: 'uuid' },
          config: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      File: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          libraryId: { type: 'string', format: 'uuid' },
          path: { type: 'string' },
          name: { type: 'string' },
          isDir: { type: 'boolean' },
          size: { type: 'integer' },
          mimeType: { type: 'string' },
          mtime: { type: 'string', format: 'date-time' },
          frontmatter: { type: 'object' },
        },
      },
      Conversation: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          libraryId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          currentNoteId: { type: 'string' },
          messageCount: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          conversationId: { type: 'string', format: 'uuid' },
          role: { type: 'string', enum: ['user', 'assistant', 'system', 'tool'] },
          content: { type: 'string' },
          metadata: { type: 'object' },
          citations: { type: 'array', items: { type: 'object' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          conversationId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' },
          libraryId: { type: 'string', format: 'uuid' },
          goal: { type: 'string' },
          plan: { type: 'object' },
          status: {
            type: 'string',
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
          },
          currentStep: { type: 'integer' },
          totalSteps: { type: 'integer' },
          providerId: { type: 'string', format: 'uuid' },
          model: { type: 'string' },
          parameters: { type: 'object' },
          lockFiles: { type: 'array', items: { type: 'string' } },
          result: { type: 'object' },
          error: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time' },
        },
      },
      Provider: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['openai', 'ollama', 'lm-studio', 'custom'] },
          baseUrl: { type: 'string', format: 'uri' },
          chatModel: { type: 'string' },
          embedModel: { type: 'string' },
          rerankModel: { type: 'string' },
          capabilities: { type: 'array', items: { type: 'string' } },
          isDefault: { type: 'boolean' },
          discoveredModels: { type: 'array', items: { type: 'string' } },
        },
      },
      McpToken: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          libraryId: { type: 'string', format: 'uuid' },
          permissions: {
            type: 'object',
            properties: {
              read: { type: 'boolean' },
              write: { type: 'boolean' },
              git: { type: 'boolean' },
            },
          },
          expiresAt: { type: 'string', format: 'date-time' },
          revokedAt: { type: 'string', format: 'date-time' },
          lastUsedAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check',
        responses: { '200': { description: 'OK' }, '503': { description: 'Unhealthy' } },
      },
    },
    '/auth/setup': {
      post: {
        summary: 'First-run setup',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SetupRequest' } },
          },
        },
        responses: {
          '201': { description: 'Created' },
          '400': { description: 'Already initialized' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } },
          },
        },
        responses: { '200': { description: 'OK' }, '401': { description: 'Invalid credentials' } },
      },
    },
    '/auth/logout': { post: { summary: 'Logout', responses: { '200': { description: 'OK' } } } },
    '/auth/me': {
      get: {
        summary: 'Get current user',
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
          },
          '401': { description: 'Not authenticated' },
        },
      },
    },
    '/libraries': {
      get: {
        summary: 'List libraries',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Library' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create library',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateLibraryRequest' } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/libraries/{id}': {
      get: {
        summary: 'Get library',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Library' } } },
          },
          '404': { description: 'Not found' },
        },
      },
      patch: {
        summary: 'Update library',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/UpdateLibraryRequest' } },
          },
        },
        responses: { '200': { description: 'OK' } },
      },
      delete: {
        summary: 'Delete library registration',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/files/{libraryId}/tree': {
      get: {
        summary: 'Get file tree',
        parameters: [
          {
            name: 'libraryId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/search/{libraryId}': {
      get: {
        summary: 'Search library',
        parameters: [
          {
            name: 'libraryId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          { name: 'q', in: 'query', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/git/{libraryId}/status': {
      get: {
        summary: 'Git status',
        parameters: [
          {
            name: 'libraryId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': { description: 'OK' } },
      },
    },
    '/ai/providers': {
      get: {
        summary: 'List providers',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Provider' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create provider',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateProviderRequest' } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/ai/chat/conversations': {
      get: {
        summary: 'List conversations',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Conversation' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create conversation',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateConversationRequest' },
            },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/ai/agent/tasks': {
      get: {
        summary: 'List agent tasks',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create agent task',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateAgentTaskRequest' } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/mcp/tokens': {
      get: {
        summary: 'List MCP tokens',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: { type: 'array', items: { $ref: '#/components/schemas/McpToken' } },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create MCP token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateMcpTokenRequest' } },
          },
        },
        responses: { '201': { description: 'Created' } },
      },
    },
    '/diagnostics/health': {
      get: {
        summary: 'Health check details',
        responses: { '200': { description: 'OK' }, '503': { description: 'Unhealthy' } },
      },
    },
    '/diagnostics/status': {
      get: { summary: 'System status', responses: { '200': { description: 'OK' } } },
    },
  },
};

writeFileSync(resolve(ROOT, 'openapi.json'), JSON.stringify(openApiSpec, null, 2));
console.log('✅ OpenAPI spec generated at openapi.json');
