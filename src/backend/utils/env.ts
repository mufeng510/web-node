// Environment variable access helper
// Using bracket notation for TypeScript index signature compatibility
// biome-ignore lint/style/useLiteralKeys: process.env access with bracket notation for index signatures
export function getEnv(key: string): string | undefined {
  return process.env[key];
}

// biome-ignore lint/style/useLiteralKeys: process.env access with bracket notation for index signatures
export function getEnvRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}
