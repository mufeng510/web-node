import { constants, access, readdir, readlink, stat } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { SymlinkEscapeError } from '../../utils/errors.js';
import { getLibraryRoot, shouldHideDir, shouldHideFile } from '../../utils/path.js';

export interface TreeNode {
  id: string;
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size: number;
  mimeType?: string;
  mtime: Date;
  children?: TreeNode[];
  hidden?: boolean;
}

export async function scanLibraryTree(
  libraryPath: string,
  options: {
    showHidden?: boolean;
    showObsidian?: boolean;
    showGit?: boolean;
    maxDepth?: number;
    currentDepth?: number;
  } = {}
): Promise<TreeNode[]> {
  const {
    showHidden = false,
    showObsidian = false,
    showGit = false,
    maxDepth = 10,
    currentDepth = 0,
  } = options;

  if (currentDepth > maxDepth) return [];

  const root = getLibraryRoot(libraryPath);
  const entries = await readdir(root, { withFileTypes: true });

  const nodes: TreeNode[] = [];

  for (const entry of entries) {
    const name = entry.name;
    const fullPath = join(root, name);
    const relPath = relative(root, fullPath);

    if (shouldHideDir(name, showHidden, showObsidian, showGit)) continue;
    if (!entry.isDirectory() && shouldHideFile(name, showHidden)) continue;

    try {
      await access(fullPath, constants.R_OK);
    } catch {
      continue;
    }

    let stats: any;
    let mimeType: string | undefined;
    let size = 0;

    try {
      stats = await stat(fullPath);
      size = stats.size;
      if (!stats.isDirectory()) {
        mimeType = getMimeType(name);
      }
    } catch {
      continue;
    }

    const node: TreeNode = {
      id: `${relPath.replace(/\//g, '_')}_${Date.now()}`,
      name,
      path: fullPath,
      relativePath: relPath,
      isDir: stats.isDirectory(),
      size,
      mimeType,
      mtime: stats.mtime,
      hidden: name.startsWith('.'),
    };

    if (stats.isDirectory()) {
      node.children = await scanLibraryTree(libraryPath, {
        showHidden,
        showObsidian,
        showGit,
        maxDepth,
        currentDepth: currentDepth + 1,
      });
    }

    nodes.push(node);
  }

  nodes.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}

export async function getFileMetadata(libraryPath: string, relativePath: string) {
  const fullPath = getLibraryRoot(libraryPath);
  const absolutePath = join(fullPath, relativePath);

  try {
    const stats = await stat(absolutePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      isDir: stats.isDirectory(),
      mimeType: stats.isDirectory() ? undefined : getMimeType(basename(relativePath)),
    };
  } catch {
    return null;
  }
}

export async function checkSymlinkSafety(libraryPath: string, linkPath: string): Promise<void> {
  const root = getLibraryRoot(libraryPath);
  const absoluteLink = join(root, linkPath);

  try {
    const target = await readlink(absoluteLink);
    const absoluteTarget = target.startsWith('/') ? target : join(root, target);
    const relativeTarget = relative(root, absoluteTarget);

    if (relativeTarget.startsWith('..') || absoluteTarget.startsWith('..')) {
      throw new SymlinkEscapeError(linkPath, target);
    }
  } catch (error) {
    if (error instanceof SymlinkEscapeError) throw error;
  }
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    yaml: 'application/yaml',
    yml: 'application/yaml',
    js: 'application/javascript',
    ts: 'application/typescript',
    html: 'text/html',
    css: 'text/css',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    pdf: 'application/pdf',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    excalidraw: 'application/x-excalidraw',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
