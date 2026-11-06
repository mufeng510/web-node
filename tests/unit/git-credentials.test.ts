import { beforeEach, describe, expect, it } from 'vitest';

process.env.MASTER_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const { encrypt } = await import('@backend/utils/crypto');
const { encryptGitConfig, looksLikeCiphertext } = await import(
  '@backend/modules/libraries/routes-helpers'
);

describe('encryptGitConfig（库级 gitConfig 的凭据加密）', () => {
  it('前端留空凭据时沿用已有的密文，不二次加密', () => {
    const stored = encrypt('ghp_existing');
    const result = encryptGitConfig(
      { authType: 'https' },
      { authType: 'https', credentials: stored }
    );
    expect(result.credentials).toBe(stored);
    expect(looksLikeCiphertext(result.credentials)).toBe(true);
  });

  it('前端传入明文时只加密一次', () => {
    const result = encryptGitConfig({ credentials: 'ghp_new' }, undefined);
    expect(result.credentials).not.toBe('ghp_new');
    expect(looksLikeCiphertext(result.credentials)).toBe(true);
  });

  it('传入的已是密文时不重复加密', () => {
    const stored = encrypt('ghp_existing');
    const result = encryptGitConfig({ credentials: stored }, { credentials: stored });
    expect(result.credentials).toBe(stored);
  });

  it('空字符串表示清除凭据', () => {
    const result = encryptGitConfig({ credentials: '' }, { credentials: encrypt('old') });
    expect(result.credentials).toBe('');
  });
});

describe('looksLikeCiphertext', () => {
  it('识别本应用的密文与普通 token', () => {
    expect(looksLikeCiphertext(encrypt(`ghp_${'a'.repeat(36)}`))).toBe(true);
    expect(looksLikeCiphertext(`ghp_${'a'.repeat(36)}`)).toBe(false);
    expect(looksLikeCiphertext('/home/webnote/.ssh/id_ed25519')).toBe(false);
    expect(looksLikeCiphertext(undefined)).toBe(false);
  });
});

beforeEach(() => {});
