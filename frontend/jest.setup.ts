import 'react-native-gesture-handler/jestSetup';

// Standard mock for @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock uuid to prevent ESM export syntax error in Jest
jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-v4',
}));

// Pre-emptively mock react-native-sqlite-storage before any service or repository imports it
jest.mock('react-native-sqlite-storage', () => {
  const createTransaction = () => ({
    executeSql: jest.fn(
      (
        _sql: string,
        _params: unknown[] = [],
        success?: (tx: unknown, result: { rows: { length: number; item: (index: number) => Record<string, unknown> }; rowsAffected: number }) => void,
        _failure?: (tx: unknown, error: Error) => boolean
      ) => {
        const result = {
          rows: {
            length: 0,
            item: () => ({}),
          },
          rowsAffected: 0,
        };
        success?.({}, result);
      }
    ),
  });

  const createMockDb = () => ({
    transaction: jest.fn(
      (
        callback: (tx: ReturnType<typeof createTransaction>) => void,
        _error?: (error: Error) => void,
        success?: () => void
      ) => {
        callback(createTransaction());
        success?.();
      }
    ),
    executeSql: jest.fn(
      (
        _sql: string,
        _params: unknown[] = [],
        success?: (tx: unknown, result: { rows: { length: number; item: (index: number) => Record<string, unknown> }; rowsAffected: number }) => void,
        _failure?: (tx: unknown, error: Error) => boolean
      ) => {
        const result = {
          rows: {
            length: 0,
            item: () => ({}),
          },
          rowsAffected: 0,
        };
        success?.({}, result);
        return Promise.resolve([result]);
      }
    ),
    readTransaction: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    attach: jest.fn(),
    detach: jest.fn(),
  });

  const openDatabase = jest.fn((...args: unknown[]) => {
    const db = createMockDb();
    if (typeof args[1] === 'function') {
      (args[1] as any)(db);
    }
    return Promise.resolve(db);
  });

  const enablePromise = jest.fn();
  const DEBUG = jest.fn();

  return {
    __esModule: true,
    default: {
      openDatabase,
      enablePromise,
      DEBUG,
    },
    openDatabase,
    enablePromise,
    DEBUG,
  };
});
