import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/protocols/aptree/userPositions
 * Placeholder for portfolio integration until Aptree exposes wallet positions API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json(
      { success: false, error: 'Address parameter is required' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: [],
    source: 'aptree-placeholder',
  });
}
