import { formatDistanceToNow as dfnsFormatDistanceToNow } from 'date-fns';

export function formatDistanceToNow(date: string | number | Date): string {
  try {
    return dfnsFormatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '';
  }
}
