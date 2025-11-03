/**
 * Domain and environment utilities for better resource loading
 */

/**
 * Check if we're on the main domain (yieldai.app)
 */
export function isMainDomain(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname === 'yieldai.app' || hostname === 'www.yieldai.app';
}

/**
 * Check if we're on a Vercel subdomain
 */
export function isVercelSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  
  const hostname = window.location.hostname;
  return hostname.includes('.vercel.app');
}

/**
 * Get optimized image URL with fallback handling
 */
export function getOptimizedImageUrl(src: string, fallback?: string): string {
  if (!src) return fallback || '/favicon.ico';
  
  // If it's already a full URL, return as is
  if (src.startsWith('http')) {
    return src;
  }
  
  // For main domain, add cache busting parameter
  if (isMainDomain()) {
    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}v=${Date.now()}`;
  }
  
  return src;
}

/**
 * Get base URL with domain-specific optimizations
 */
export function getOptimizedBaseUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }
  
  const origin = window.location.origin;
  
  // For main domain, ensure we're using HTTPS
  if (isMainDomain()) {
    return origin.replace('http://', 'https://');
  }
  
  return origin;
}

/**
 * Check if we should use aggressive caching
 */
export function shouldUseAggressiveCaching(): boolean {
  return isVercelSubdomain();
}

/**
 * Get cache strategy based on domain
 */
export function getCacheStrategy(): 'aggressive' | 'conservative' | 'disabled' {
  if (isVercelSubdomain()) {
    return 'aggressive';
  }
  
  if (isMainDomain()) {
    return 'conservative';
  }
  
  return 'disabled';
}

/**
 * Preload critical resources for main domain
 */
export function preloadCriticalResources(): void {
  if (typeof window === 'undefined' || !isMainDomain()) return;
  
  const criticalResources = [
    '/logo.png',
    '/favicon.ico',
    '/_next/static/css/app/layout.css'
  ];
  
  criticalResources.forEach(resource => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = resource;
    link.as = resource.endsWith('.css') ? 'style' : 'image';
    document.head.appendChild(link);
  });
}

/**
 * Retry failed resource loads
 */
export function retryFailedResource(src: string, maxRetries: number = 3): Promise<string> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryLoad = () => {
      attempts++;
      
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = () => {
        if (attempts < maxRetries) {
          setTimeout(tryLoad, 1000 * attempts); // Exponential backoff
        } else {
          reject(new Error(`Failed to load ${src} after ${maxRetries} attempts`));
        }
      };
      
      img.src = src;
    };
    
    tryLoad();
  });
}

