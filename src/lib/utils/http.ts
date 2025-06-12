import { ApiError, ApiResponse } from '../types/api';

export function createErrorResponse(error: Error): ApiResponse<never> {
  return {
    error: error.message,
  };
}

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
  };
} 