'use client';

import { useEffect } from 'react';
import { isMainDomain, preloadCriticalResources } from '@/lib/utils/domainUtils';

/**
 * Component to preload critical resources for better performance
 * Especially important for main domain (yieldai.app)
 */
export function ResourcePreloader() {
  useEffect(() => {
    // Only preload on main domain
    if (isMainDomain()) {
      preloadCriticalResources();
      
      // Additional preloading for main domain
      const additionalResources = [
        '/android-chrome-192x192.png',
        '/android-chrome-512x512.png',
        '/apple-touch-icon.png',
        '/favicon-32x32.png',
        '/favicon-16x16.png'
      ];
      
      additionalResources.forEach(resource => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = resource;
        link.as = 'image';
        document.head.appendChild(link);
      });
    }
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Hook to preload resources dynamically
 */
export function useResourcePreloader() {
  useEffect(() => {
    const preloadResource = (href: string, as: string = 'image') => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      document.head.appendChild(link);
    };

    // Preload critical CSS
    const cssLinks = document.querySelectorAll('link[rel="stylesheet"]');
    cssLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.includes('_next/static')) {
        preloadResource(href, 'style');
      }
    });

    // Preload critical images
    const imageElements = document.querySelectorAll('img[src]');
    imageElements.forEach(img => {
      const src = img.getAttribute('src');
      if (src && src.startsWith('/')) {
        preloadResource(src, 'image');
      }
    });
  }, []);
}

