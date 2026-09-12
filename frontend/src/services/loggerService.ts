import { Platform } from 'react-native';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogModule =
  | 'Scanner'
  | 'OCR'
  | 'Sync'
  | 'API'
  | 'Database'
  | 'Storage'
  | 'UI'
  | 'App'
  | 'Vision';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  module: LogModule;
  message: string;
  data?: any;
}

export interface LogFilter {
  level?: LogLevel;
  module?: LogModule;
  query?: string;
}

class LoggerService {
  private buffer: LogEntry[] = [];
  private readonly maxBufferSize = 500;
  private idCounter = 0;

  private addEntry(level: LogLevel, module: LogModule, message: string, data?: any): void {
    const entry: LogEntry = {
      id: `${Date.now()}_${++this.idCounter}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      data: data ? (typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : data) : undefined,
    };

    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift();
    }
    this.buffer.push(entry);

    // Also output to dev console
    const formatted = `[${entry.timestamp.substring(11, 19)}] [${entry.module}] [${entry.level}] ${entry.message}`;
    if (level === 'ERROR') {
      console.error(formatted, data || '');
    } else if (level === 'WARN') {
      console.warn(formatted, data || '');
    } else {
      console.log(formatted, data || '');
    }
  }

  debug(module: LogModule, message: string, data?: any): void {
    this.addEntry('DEBUG', module, message, data);
  }

  info(module: LogModule, message: string, data?: any): void {
    this.addEntry('INFO', module, message, data);
  }

  warn(module: LogModule, message: string, data?: any): void {
    this.addEntry('WARN', module, message, data);
  }

  error(module: LogModule, message: string, data?: any): void {
    this.addEntry('ERROR', module, message, data);
  }

  getLogs(filter?: LogFilter): LogEntry[] {
    let result = [...this.buffer];

    if (filter?.level) {
      result = result.filter((l) => l.level === filter.level);
    }
    if (filter?.module) {
      result = result.filter((l) => l.module === filter.module);
    }
    if (filter?.query) {
      const q = filter.query.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q) ||
          (l.data && JSON.stringify(l.data).toLowerCase().includes(q))
      );
    }

    return result.reverse(); // Most recent first
  }

  getRecentLogs(count = 50): LogEntry[] {
    return this.buffer.slice(-count).reverse();
  }

  clearLogs(): void {
    this.buffer = [];
  }

  exportLogsAsText(): string {
    const lines = [
      `=== ContextVault Diagnostics Log Export ===`,
      `Platform: ${Platform.OS} (v${Platform.Version})`,
      `Exported: ${new Date().toISOString()}`,
      `Total Entries: ${this.buffer.length}`,
      `-------------------------------------------`,
      ...this.buffer.map((entry) => {
        let line = `[${entry.timestamp}] [${entry.level}] [${entry.module}] ${entry.message}`;
        if (entry.data) {
          try {
            line += ` | ${JSON.stringify(entry.data)}`;
          } catch {
            line += ` | [Object]`;
          }
        }
        return line;
      }),
      `=== End of Diagnostics Log ===`,
    ];
    return lines.join('\n');
  }

  exportLogsAsJson(): string {
    return JSON.stringify(
      {
        platform: Platform.OS,
        platformVersion: Platform.Version,
        exportedAt: new Date().toISOString(),
        totalEntries: this.buffer.length,
        logs: this.buffer,
      },
      null,
      2
    );
  }
}

export const loggerService = new LoggerService();
