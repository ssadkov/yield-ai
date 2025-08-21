import { NextResponse } from 'next/server';
import echelonMarkets from '@/lib/data/echelonMarkets.json';

/**
 * @swagger
 * /api/protocols/echelon/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get all pools from Echelon protocol
 *     responses:
 *       200:
 *         description: Pools retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 marketData:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       market:
 *                         type: string
 *                       coin:
 *                         type: string
 *                       supplyAPR:
 *                         type: number
 *                       borrowAPR:
 *                         type: number
 *       500:
 *         description: Internal server error
 */
export async function GET() {
  try {
    const externalApiUrl = "https://yield-a.vercel.app/api/echelon/markets";
    console.log('Fetching from external API:', externalApiUrl);
    
    // Get base URL from environment or use default
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || process.env.VERCEL_URL || 'http://localhost:3000';
    
    const response = await fetch(externalApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': baseUrl,
        'Referer': `${baseUrl}/`
      }
    });
    
    console.log('External API response status:', response.status);
    console.log('External API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.error('External API error response:', text);
      console.log('Using local market data due to API error');
      return NextResponse.json({
        success: true,
        marketData: echelonMarkets.markets
      });
    }

    const data = await response.json();
    console.log('External API response data:', data);
    console.log('External API - marketData length:', data.marketData?.length);
    console.log('External API - marketData coins:', data.marketData?.map((m: any) => m.coin));
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Echelon pools:", error);
    console.log('Using local market data due to fetch error');
    return NextResponse.json({
      success: true,
      marketData: echelonMarkets.markets
    });
  }
} 