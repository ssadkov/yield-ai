import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/hyperion/pools:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get all pools from Hyperion protocol
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       poolId:
 *                         type: string
 *                       token1:
 *                         type: string
 *                       token2:
 *                         type: string
 *                       token1Info:
 *                         type: object
 *                       token2Info:
 *                         type: object
 *                       tvl:
 *                         type: string
 *                       apy:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
export async function GET() {
  try {
    // Получаем данные из внешнего API
    const externalApiUrl = "https://yield-a.vercel.app/api/hyperion/pools";
    const response = await fetch(externalApiUrl);
    
    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Hyperion pools:", error);
    return NextResponse.json(
      { error: "Failed to fetch pools" },
      { status: 500 }
    );
  }
} 