/**
 * Formats a byte number into human-readable size (KB, MB, GB).
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Formats an ISO date string to a localized readable format.
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Truncates text with an ellipsis if it exceeds maxLength.
 */
export function truncateText(text?: string | null, maxLength = 80): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Formats latency value into a colored indicator category.
 */
export function getLatencyStatus(ms: number): { label: string; color: string } {
  if (ms < 150) return { label: 'Fast', color: 'text-emerald-400' };
  if (ms < 500) return { label: 'Moderate', color: 'text-amber-400' };
  return { label: 'Slow', color: 'text-rose-400' };
}
