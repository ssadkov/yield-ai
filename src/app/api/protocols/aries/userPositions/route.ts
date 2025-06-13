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
    const response = await fetch(externalApiUrl);
    
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