/**
 * Utility functions for configuration and environment variables
 */

/**
 * Get the base URL for API calls
 * Priority: VERCEL_URL > localhost:3000
 * Note: For client-side, use getClientBaseUrl() instead
 */
export function getBaseUrl(): string {
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
