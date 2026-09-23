type Row = Record<string, unknown>;

const createTransaction = () => ({
  executeSql: jest.fn(
    (
      _sql: string,
      _params: unknown[] = [],
      success?: (tx: unknown, result: { rows: { length: number; item: (index: number) => Row }; rowsAffected: number }) => void,
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

const createMockDatabase = () => ({
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
      success?: (tx: unknown, result: { rows: { length: number; item: (index: number) => Row }; rowsAffected: number }) => void,
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
  const db = createMockDatabase();
  if (typeof args[1] === 'function') {
    (args[1] as (database: ReturnType<typeof createMockDatabase>) => void)(db);
  }
  return Promise.resolve(db);
});

const enablePromise = jest.fn();
const DEBUG = jest.fn();

export default {
  openDatabase,
  enablePromise,
  DEBUG,
};

export { openDatabase, enablePromise, DEBUG };
