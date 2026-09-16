import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { getEnv } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const _SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getMasterKey(): Buffer {
  const env = getEnv();
  return scryptSync(env.MASTER_ENCRYPTION_KEY, 'webnote-salt', KEY_LENGTH);
}

export function encrypt(plaintext: string): string {
  try {
    const key = getMasterKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const tag = cipher.getAuthTag();

    const result = Buffer.concat([iv, ciphertext, tag]);
    return result.toString('base64');
  } catch (error) {
    throw new Error(
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function decrypt(ciphertextB64: string): string {
  try {
    const key = getMasterKey();
    const data = Buffer.from(ciphertextB64, 'base64');

    if (data.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('Invalid ciphertext: too short');
    }

    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(-TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH, -TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    return plaintext.toString('utf8');
  } catch (error) {
    throw new Error(
      `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export function hashSecret(secret: string): string {
  return scryptSync(secret, 'webnote-secret-salt', 32).toString('hex');
}

export function verifySecret(secret: string, hash: string): boolean {
  const computedHash = hashSecret(secret);
  return timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(hash, 'hex'));
}

export function generateSecureToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

export function generateApiKey(): string {
  return `wn_${randomBytes(24).toString('base64url')}`;
}
