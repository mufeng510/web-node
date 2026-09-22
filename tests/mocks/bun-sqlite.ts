// CI stub for bun:sqlite (Bun 原生模块在 Node/vitest 下不存在)
// 提供与 bun:sqlite 相同的 Database API 表面，测试通过 DI/内存路径使用，
// 若需真实读写可后续接入 node:sqlite（Node 22+）
export class Database {
  constructor(_path?: string) {}
  prepare(_query: string) {
    return {
      run: () => ({ changes: 0, lastInsertRowid: 0 }),
      get: () => undefined,
      all: () => [],
      values: () => [],
      iterate: function* () {},
      finalize: () => {},
    };
  }
  query(_sql: string) {
    return this.prepare(_sql);
  }
  exec(_sql: string) {}
  run(_sql: string) {}
  transaction(fn: (...args: unknown[]) => unknown) {
    return (...args: unknown[]) => fn(...args);
  }
  close() {}
}
export default Database;
