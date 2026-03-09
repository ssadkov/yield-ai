'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { DEFAULT_QUERY_OPTIONS } from './config';

interface QueryProviderProps {
  children: React.ReactNode;
}

/**
 * QueryProvider component that wraps the application with TanStack Query
 * Provides centralized query management, caching, and error handling
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create a new QueryClient instance with default options
  // Using useState to ensure the client is created only once per component lifecycle
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            ...DEFAULT_QUERY_OPTIONS,
            // Global error handler can be added here if needed
            // onError: (error) => {
            //   console.error('Query error:', error);
            // },
          },
          mutations: {
            retry: 1,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Global mutation error handler can be added here if needed
            // onError: (error) => {
            //   console.error('Mutation error:', error);
            // },
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
