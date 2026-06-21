import { add } from './math';

export function formatString(s: string): string {
  return s.toUpperCase() + ' - ' + add(1, 2);
}
