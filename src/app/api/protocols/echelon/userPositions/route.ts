import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/echelon/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Echelon protocol
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
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       assetName:
 *                         type: string
 *                       assetType:
 *                         type: string
 *                         enum: [supply, borrow]
 *                       balance:
 *                         type: string
 *                       apy:
 *                         type: string
 *                       value:
 *                         type: string
 *                       assetInfo:
 *                         type: object
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

    // Получаем данные из внешнего API
    const externalApiUrl = `https://yield-a.vercel.app/api/echelon/userPositions?address=${address}`;
    const response = await fetch(externalApiUrl);
    
    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Echelon user positions:", error);
    return NextResponse.json(
      {
        success: true,
        data: []
      },
      { status: 200 }
    );
  }
} 