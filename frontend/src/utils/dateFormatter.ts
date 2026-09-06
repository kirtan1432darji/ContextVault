import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';

export const DateFormatter = {
  formatShortDate(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM d, yyyy');
  },

  formatFullDateTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return format(d, 'MMM d, yyyy • h:mm a');
  },

  formatRelative(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    if (isToday(d)) {
      return `Today, ${format(d, 'h:mm a')}`;
    }
    if (isYesterday(d)) {
      return `Yesterday, ${format(d, 'h:mm a')}`;
    }
    return formatDistanceToNow(d, { addSuffix: true });
  },

  formatTime(date: string | Date): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    return format(d, 'h:mm a');
  },
};
