import { isAbsolute, relative, resolve, sep } from 'node:path';
import { getEnv } from '../config/env.js';
import { PathTraversalError, SymlinkEscapeError } from './errors.js';

export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
}

export function joinPaths(...paths: string[]): string {
  return normalizePath(paths.join('/'));
}

export function getLibraryRoot(libraryPath: string): string {
  const env = getEnv();
  const dataRoot = resolve(env.DATA_ROOT);
  const libPath = resolve(dataRoot, libraryPath);

  if (!libPath.startsWith(dataRoot + sep) && libPath !== dataRoot) {
    throw new PathTraversalError(libraryPath);
  }

  return libPath;
}

export function getLibraryConfigPath(libraryPath: string): string {
  return joinPaths(getLibraryRoot(libraryPath), '.webnote', 'config.json');
}

export function getLibraryTrashPath(libraryPath: string): string {
  return joinPaths(getLibraryRoot(libraryPath), '.webnote', 'trash');
}

export function getLibraryIndexPath(libraryPath: string): string {
  return joinPaths(getLibraryRoot(libraryPath), '.webnote', 'index');
}

export function getLibraryCachePath(libraryPath: string): string {
  return joinPaths(getLibraryRoot(libraryPath), '.webnote', 'cache');
}

export function isPathInLibrary(libraryRoot: string, targetPath: string): boolean {
  const resolvedRoot = resolve(libraryRoot);
  const resolvedTarget = resolve(targetPath);
  return resolvedTarget.startsWith(resolvedRoot + sep) || resolvedTarget === resolvedRoot;
}

export function validateSymlink(libraryRoot: string, linkPath: string, targetPath: string): void {
  const resolvedRoot = resolve(libraryRoot);
  const resolvedTarget = resolve(targetPath);

  if (!resolvedTarget.startsWith(resolvedRoot + sep) && resolvedTarget !== resolvedRoot) {
    throw new SymlinkEscapeError(linkPath, targetPath);
  }
}

export function getRelativePath(libraryRoot: string, absolutePath: string): string {
  const rel = relative(libraryRoot, absolutePath);
  return normalizePath(rel);
}

export function getAbsolutePath(libraryRoot: string, relativePath: string): string {
  const normalized = normalizePath(relativePath);
  if (isAbsolute(normalized)) {
    throw new PathTraversalError(relativePath);
  }
  return resolve(libraryRoot, normalized);
}

export function isHiddenFile(name: string): boolean {
  return name.startsWith('.') && name !== '.' && name !== '..';
}

export function isSystemDir(name: string): boolean {
  return ['.webnote', '.git', '.obsidian'].includes(name);
}

export function shouldHideFile(name: string, showHidden: boolean): boolean {
  if (!showHidden && isHiddenFile(name)) return true;
  return false;
}

export function shouldHideDir(
  name: string,
  showHidden: boolean,
  showObsidian: boolean,
  showGit: boolean
): boolean {
  if (!showHidden && isHiddenFile(name)) return true;
  if (!showObsidian && name === '.obsidian') return true;
  if (!showGit && name === '.git') return true;
  return false;
}
