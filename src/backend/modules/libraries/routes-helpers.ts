/**
 * 库级 gitConfig 的凭据加密工具。
 *
 * 凭据可能来自两条路径：库里已加密的 JSON（libraries.gitConfig），或前端
 * 回传的明文。两者的区别不明显，重复加密会直接导致密文不可解——所以这里
 * 统一判断，只加密真正的明文。
 */
import { encrypt } from '../../utils/crypto.js';

/** 判断一个字符串是否是本应用产生的 AES-GCM 密文（iv + ct + tag，base64） */
export function looksLikeCiphertext(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  // iv(12) + tag(16) 至少 28 字节 -> base64 至少 40 字符
  if (value.length < 40) return false;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  return Buffer.from(value, 'base64').length >= 12 + 16;
}

/**
 * 将 git 配置中的敏感 credentials 加密后再持久化。
 * `previous` 为库中已存的配置：未提供 credentials 时沿用旧值，避免误清空。
 */
export function encryptGitConfig(gitConfig: any, previous?: any): any {
  if (!gitConfig || typeof gitConfig !== 'object') return gitConfig;

  // 前端没有提供 credentials 字段（undefined），说明用户没有修改凭据：
  // 保留之前的值，绝不再加密一次
  if (gitConfig.credentials === undefined && previous?.credentials) {
    return { ...previous, ...gitConfig, credentials: previous.credentials };
  }

  const merged = { ...(previous ?? {}), ...gitConfig };
  if (!merged.credentials) return merged;
  return {
    ...merged,
    credentials: looksLikeCiphertext(merged.credentials)
      ? merged.credentials
      : encrypt(merged.credentials),
  };
}
