import { NextResponse } from 'next/server';

export async function GET() {
  console.log('Auro Finance - Testing external API availability');
  
  try {
    const response = await fetch('https://api.auro.finance/api/v1/pool', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Auro Finance - External API response status:', response.status);
    console.log('Auro Finance - External API response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.log('Auro Finance - External API error response:', errorText);
      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
        message: 'Auro Finance API is not available'
      });
    }

    const data = await response.json();
    console.log('Auro Finance - External API data length:', Array.isArray(data) ? data.length : 'Not an array');
    console.log('Auro Finance - External API sample data:', Array.isArray(data) ? data.slice(0, 2) : data);

    return NextResponse.json({
      success: true,
      status: response.status,
      dataLength: Array.isArray(data) ? data.length : 0,
      message: 'Auro Finance API is available',
      sampleData: Array.isArray(data) ? data.slice(0, 2) : data
    });

  } catch (error) {
    console.error('Auro Finance - External API test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Auro Finance API test failed'
    }, { status: 500 });
  }
}

