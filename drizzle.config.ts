import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'drizzle-kit';
import { getEnvRequired } from './src/backend/utils/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  schema: './src/backend/db/schema/*.ts',
  out: './src/backend/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: getEnvRequired('DATABASE_URL') || 'file:./app-data/webnote.db',
  },
  verbose: true,
  strict: true,
});
