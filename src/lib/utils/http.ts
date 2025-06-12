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

export const http = {
  get: async (url: string, options?: { headers?: Record<string, string> }) => {
    const response = await fetch(url, {
      method: 'GET',
      headers: options?.headers
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}; 