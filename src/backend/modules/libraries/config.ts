import { constants, access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { APP_CONSTANTS } from '../../config/constants.js';
import { ValidationError } from '../../utils/errors.js';
import { getLibraryRoot } from '../../utils/path.js';

export interface LibraryConfig {
  name: string;
  path: string;
  ownerId: string;
  git: {
    enabled: boolean;
    remoteUrl: string;
    branch: string;
    authType: 'none' | 'https' | 'ssh';
    credentials?: string;
    autoBackup: boolean;
    autoBackupSchedule: string;
  };
  aiIndex: {
    enabled: boolean;
    providerId: string;
    embedModel: string;
    chunkSize: number;
    chunkOverlap: number;
    excludePatterns: string[];
  };
  attachments: {
    defaultDir: string;
    allowedTypes: string[];
  };
  visibility: {
    showHiddenFiles: boolean;
    showObsidianDir: boolean;
    showGitDir: boolean;
  };
  readOnly: boolean;
}

export function getDefaultConfig(): LibraryConfig {
  return JSON.parse(JSON.stringify(APP_CONSTANTS.DEFAULT_LIBRARY_CONFIG));
}

export async function readLibraryConfig(libraryPath: string): Promise<LibraryConfig | null> {
  const configPath = join(getLibraryRoot(libraryPath), '.webnote', 'config.json');

  try {
    await access(configPath, constants.R_OK);
    const content = await readFile(configPath, 'utf-8');
    const config = JSON.parse(content);
    return { ...getDefaultConfig(), ...config };
  } catch {
    return null;
  }
}

export async function writeLibraryConfig(
  libraryPath: string,
  config: LibraryConfig
): Promise<void> {
  const configDir = join(getLibraryRoot(libraryPath), '.webnote');
  const configPath = join(configDir, 'config.json');

  await mkdir(configDir, { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export async function initializeLibraryConfig(
  libraryPath: string,
  name: string,
  ownerId: string
): Promise<LibraryConfig> {
  const config = getDefaultConfig();
  config.name = name;
  config.path = libraryPath;
  config.ownerId = ownerId;

  await writeLibraryConfig(libraryPath, config);
  return config;
}

export async function migrateLibraryConfig(libraryPath: string): Promise<LibraryConfig> {
  const existing = await readLibraryConfig(libraryPath);
  const defaults = getDefaultConfig();

  if (!existing) {
    throw new ValidationError('No existing config to migrate');
  }

  const merged = deepMerge(defaults, existing);
  await writeLibraryConfig(libraryPath, merged);
  return merged;
}

function deepMerge(target: any, source: any): any {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
