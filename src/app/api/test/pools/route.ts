import { NextRequest, NextResponse } from 'next/server';
import { PoolValidator } from '@/lib/utils/poolValidator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, transform } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Test the API source
    const result = await PoolValidator.testApiSource(url, transform);
    
    // Log results for debugging
    PoolValidator.logValidationResult(result, url);

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Error testing pool source:', error);
    return NextResponse.json(
      { error: 'Failed to test pool source' },
      { status: 500 }
    );
  }
} 