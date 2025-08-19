import { NextResponse } from 'next/server';

// Test endpoint for Earnium user positions (stubbed)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ success: false, error: 'Address is required' }, { status: 400 });
    }

    // Return empty positions array as a starting point
    return NextResponse.json({ success: true, data: [] }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4'
      }
    });
  } catch (error) {
    return NextResponse.json({ success: true, data: [] }, { status: 200 });
  }
}


