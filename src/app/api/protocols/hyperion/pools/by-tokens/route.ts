import { NextResponse } from 'next/server';
import { sdk } from "@/lib/hyperion";

/**
 * @swagger
 * /api/protocols/hyperion/pools/by-tokens:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get Hyperion pool by token pair and fee tier
 *     parameters:
 *       - in: query
 *         name: token1
 *         required: true
 *         schema:
 *           type: string
 *         description: First token address
 *       - in: query
 *         name: token2
 *         required: true
 *         schema:
 *           type: string
 *         description: Second token address
 *       - in: query
 *         name: feeTier
 *         required: true
 *         schema:
 *           type: number
 *         description: Fee tier index
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
 *       400:
 *         description: Missing required parameters
 *       404:
 *         description: Pool not found
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token1 = searchParams.get("token1");
    const token2 = searchParams.get("token2");
    const feeTier = searchParams.get("feeTier");

    if (!token1 || !token2 || !feeTier) {
      return NextResponse.json(
        { error: "token1, token2, and feeTier are required" },
        { status: 400 }
      );
    }

    // Используем SDK метод для получения пула по паре токенов и fee tier
    // Согласно документации: sdk.Pool.getPoolByTokenPairAndFeeTier({ token1, token2, feeTier })
    const pool = await sdk.Pool.getPoolByTokenPairAndFeeTier({
      token1: token1,
      token2: token2,
      feeTier: parseInt(feeTier)
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
    console.error("Error fetching Hyperion pool by tokens:", error);
    return NextResponse.json(
      { error: "Failed to fetch pool" },
      { status: 500 }
    );
  }
} 