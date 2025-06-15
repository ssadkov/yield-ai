import { NextResponse } from 'next/server';

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
    
    const response = await fetch(externalApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/'
      }
    });
    
    console.log('External API response status:', response.status);
    console.log('External API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.error('External API error response:', text);
      throw new Error(`External API returned ${response.status}: ${text}`);
    }

    const data = await response.json();
    console.log('External API response data:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Echelon pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch pools" },
      { status: 500 }
    );
  }
} 