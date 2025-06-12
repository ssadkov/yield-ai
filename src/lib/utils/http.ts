import { ApiError, ApiResponse } from '../types/api';

export const createErrorResponse = (error: Error): ApiResponse<never> => {
  return {
    error: error.message,
  };
};

export const createSuccessResponse = <T>(data: T): ApiResponse<T> => {
  return {
    data,
  };
};

export const http = {
  async get<T>(url: string, options?: { headers?: Record<string, string> }): Promise<T> {
    const response = await fetch(url, {
      method: 'GET',
      headers: options?.headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  },

  async post<T>(url: string, body: any, options?: { headers?: Record<string, string> }): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}; 