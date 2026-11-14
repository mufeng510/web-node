/**
 * 文件树展开状态的持久化，桌面侧栏与移动端抽屉共用同一份存储，
 * 两边看到的是同一棵树的展开情况。
 */

export function readExpanded(libraryId: string | undefined): Set<string> {
  if (!libraryId) return new Set();
  try {
    const raw = localStorage.getItem(`expanded:${libraryId}`);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set();
  }
}

export function writeExpanded(libraryId: string | undefined, next: Set<string>): void {
  if (!libraryId) return;
  try {
    localStorage.setItem(`expanded:${libraryId}`, JSON.stringify([...next]));
  } catch {
    // storage unavailable — expansion still works for this session
  }
}
