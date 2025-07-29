import { NextResponse } from 'next/server';
import { sdk } from "@/lib/hyperion";

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
    // Получаем все пулы через локальный SDK
    const pools = await sdk.Pool.fetchAllPools();
    
    // Возвращаем данные с настройками кэширования
    return NextResponse.json({
      success: true,
      data: pools
    }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4',
        'Cdn-Cache-Control': 'max-age=2',
        'Surrogate-Control': 'max-age=2'
      }
    });
  } catch (error) {
    console.error("❌ Hyperion pools error:", error);
    // Возвращаем пустой массив при ошибках
    return NextResponse.json(
      {
        success: true,
        data: []
      },
      { status: 200 }
    );
  }
} 