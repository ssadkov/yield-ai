import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, hostname } = request.nextUrl;
  
  // Check if we're on the main domain
  const isMainDomain = hostname === 'yieldai.app' || hostname === 'www.yieldai.app';
  
  // Add special headers for main domain
  if (isMainDomain) {
    const response = NextResponse.next();
    
    // Add cache control headers for static assets
    if (pathname.startsWith('/_next/static/') || 
        pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico|css|js)$/)) {
      response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    }
    
    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    
    // Add CORS headers for main domain
    response.headers.set('Access-Control-Allow-Origin', 'https://yieldai.app');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

