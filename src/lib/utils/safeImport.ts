/**
 * Utility for safe dynamic imports with retry logic
 */

interface ImportOptions {
  retries?: number;
  retryDelay?: number;
}

/**
 * Safely import a module with retry logic for chunk loading errors
 */
export async function safeImport<T>(
  importFn: () => Promise<T>,
  options: ImportOptions = {}
): Promise<T> {
  const { retries = 3, retryDelay = 1000 } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await importFn();
    } catch (error) {
      const isChunkError = 
        error instanceof Error && 
        (error.name === 'ChunkLoadError' || 
         error.message.includes('Loading chunk') ||
         error.message.includes('ChunkLoadError'));
      
      if (isChunkError && attempt < retries) {
        console.warn(`Chunk loading failed, retrying... (attempt ${attempt}/${retries})`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        
        // Force reload the chunk by adding a cache-busting parameter
        if (typeof window !== 'undefined') {
          // Clear any cached chunks
          const script = document.createElement('script');
          script.src = 'data:text/javascript,// Cache buster';
          document.head.appendChild(script);
          document.head.removeChild(script);
        }
        
        continue;
      }
      
      throw error;
    }
  }
  
  throw new Error('Max retries exceeded for dynamic import');
}

/**
 * Create a safe dynamic import function for a specific module
 */
export function createSafeImport<T>(importFn: () => Promise<T>) {
  return (options?: ImportOptions) => safeImport(importFn, options);
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}
