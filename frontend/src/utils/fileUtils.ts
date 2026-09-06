export const FileUtils = {
  formatBytes(bytes: number, decimals = 1): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  getFileName(filePath: string): string {
    if (!filePath) return '';
    return filePath.split(/[/\\]/).pop() || '';
  },

  getFileExtension(filePath: string): string {
    if (!filePath) return '';
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
  },

  generateCompositeHash(filePath: string, fileSize: number, timestamp: number): string {
    let hash = 0;
    const str = `${filePath}_${fileSize}_${timestamp}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  },
};
