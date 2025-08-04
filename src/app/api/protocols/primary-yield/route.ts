import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const protocol = searchParams.get('protocol');
    
    const url = protocol 
      ? `https://yield-a.vercel.app/api/aptos/markets?protocol=${protocol}`
      : 'https://yield-a.vercel.app/api/aptos/markets';
    
               console.log(`Proxying Joule request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      }
    });
           } catch (error) {
           console.error('Error proxying Joule API request:', error);
           return NextResponse.json(
             { error: 'Failed to fetch data from Joule API' },
             { status: 500 }
           );
         }
} 