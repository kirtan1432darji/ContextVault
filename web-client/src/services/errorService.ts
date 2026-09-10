import { AxiosError } from 'axios';
import { ApiError, ApiResponse } from '../types/api';
import { API_CONFIG } from '../utils/constants';

/**
 * Normalizes HTTP errors, network failures, and FastAPI validation envelopes
 * into a uniform ApiError structure for components and toasts.
 */
export class ErrorService {
  parse(error: unknown): ApiError {
    if (!error) {
      return {
        status: 0,
        message: 'An unknown error occurred.',
        errors: [],
      };
    }

    if (error instanceof AxiosError) {
      // 1. Network Unavailable / Docker unreachable / CORS block
      if (!error.response || error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        return {
          status: 0,
          message: `Backend API is unreachable at ${API_CONFIG.BASE_URL}. Ensure Docker container 'contextvault-api' is running and port 8000 is open.`,
          errors: ['Connection refused or network unavailable.'],
          isNetworkError: true,
        };
      }

      const status = error.response.status;
      const data = error.response.data as ApiResponse<unknown> | undefined;

      // Extract error list from ContextVault envelope if present
      const envelopeErrors = Array.isArray(data?.errors) ? data!.errors : [];
      let defaultMessage = data?.message || error.message;

      switch (status) {
        case 400:
          defaultMessage = data?.message || 'Invalid request payload. Please check your inputs.';
          break;
        case 401:
          defaultMessage = 'Your session has expired or credentials are invalid. Please sign in again.';
          break;
        case 403:
          defaultMessage = 'Access denied. You do not have permission to perform this action.';
          break;
        case 404:
          defaultMessage = data?.message || 'The requested resource was not found on the server.';
          break;
        case 409:
          defaultMessage = data?.message || 'A conflicting resource already exists.';
          break;
        case 422:
          defaultMessage = data?.message || 'Input validation failed. Please check form fields.';
          break;
        case 500:
        case 502:
        case 503:
          defaultMessage = 'Internal server error. Please verify the Docker backend logs.';
          break;
        default:
          break;
      }

      return {
        status,
        message: defaultMessage,
        errors: envelopeErrors.length > 0 ? envelopeErrors : [defaultMessage],
        code: error.code,
      };
    }

    if (error instanceof Error) {
      return {
        status: 500,
        message: error.message,
        errors: [error.message],
      };
    }

    return {
      status: 500,
      message: String(error),
      errors: [String(error)],
    };
  }
}

export const errorService = new ErrorService();
