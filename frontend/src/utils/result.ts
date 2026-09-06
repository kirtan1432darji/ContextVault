export type Result<T> =
  | { isSuccess: true; data: T; error?: never }
  | { isSuccess: false; data?: never; error: string; rawError?: any };

export const Result = {
  success<T>(data: T): Result<T> {
    return { isSuccess: true, data };
  },
  failure<T>(error: string, rawError?: any): Result<T> {
    return { isSuccess: false, error, rawError };
  },
};
