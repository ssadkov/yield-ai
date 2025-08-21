/**
 * Utility functions for configuration and environment variables
 */

/**
 * Get the base URL for API calls
 * Priority: NEXT_PUBLIC_API_URL > VERCEL_URL > localhost:3000
 */
export function getBaseUrl(): string {
  // Check for explicit API URL first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Check for Vercel URL (automatically set by Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Fallback to localhost for development
  return 'http://localhost:3000';
}

/**
 * Get the base URL for client-side API calls
 * This should be used in components and client-side code
 */
export function getClientBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // Client-side: use current origin
    return window.location.origin;
  }
  
  // Server-side: use environment variables
  return getBaseUrl();
}

/**
 * Check if we're running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if we're running on Vercel
 */
export function isVercel(): boolean {
  return !!process.env.VERCEL_URL;
}
