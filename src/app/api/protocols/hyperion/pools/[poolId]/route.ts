import { NextResponse } from 'next/server';
import { sdk } from "@/lib/hyperion";

/**
 * @swagger
 * /api/protocols/hyperion/pools/{poolId}:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get Hyperion pool by ID
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: string
 *         description: Pool ID
 *     responses:
 *       200:
 *         description: Pool retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     poolId:
 *                       type: string
 *                     token1:
 *                       type: string
 *                     token2:
 *                       type: string
 *                     feeTier:
 *                       type: number
 *                     currentTick:
 *                       type: number
 *                     sqrtPrice:
 *                       type: string
 *       400:
 *         description: Invalid pool ID
 *       404:
 *         description: Pool not found
 *       500:
 *         description: Internal server error
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;

    if (!poolId) {
      return NextResponse.json(
        { error: "Pool ID is required" },
        { status: 400 }
      );
    }

    // Используем SDK метод для получения пула по ID
    // Согласно документации: sdk.Pool.fetchPoolById({ poolId: '0xf108...876b5' })
    const pool = await sdk.Pool.fetchPoolById({
      poolId: poolId
    });

    if (!pool) {
      return NextResponse.json(
        { error: "Pool not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: pool
    });

  } catch (error) {
    console.error("Error fetching Hyperion pool by ID:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool" },
      { status: 500 }
    );
  }
} 