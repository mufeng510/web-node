let counter = 0;
const instanceId = Math.random().toString(36).substring(2, 8);

export function createId(): string {
  const timestamp = Date.now().toString(36);
  const counterStr = counter.toString(36).padStart(4, '0');
  counter = (counter + 1) % 10000;
  return `${timestamp}${instanceId}${counterStr}`;
}

export function createShortId(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
