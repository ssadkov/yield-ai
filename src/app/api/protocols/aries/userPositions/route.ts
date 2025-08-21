import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/aries/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Aries protocol
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *     responses:
 *       200:
 *         description: User positions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profiles:
 *                   type: object
 *                   properties:
 *                     profiles:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           deposits:
 *                             type: object
 *                             additionalProperties:
 *                               type: object
 *                               properties:
 *                                 collateral_amount:
 *                                   type: number
 *                                 collateral_coins:
 *                                   type: number
 *                                 collateral_value:
 *                                   type: number
 *                           borrows:
 *                             type: object
 *                             additionalProperties:
 *                               type: object
 *                               properties:
 *                                 borrowed_coins:
 *                                   type: number
 *                                 borrowed_value:
 *                                   type: number
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const externalApiUrl = `https://yield-a.vercel.app/api/aries/userPositions?address=${address}`;
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
    
    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Aries user positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch user positions" },
      { status: 500 }
    );
  }
} 