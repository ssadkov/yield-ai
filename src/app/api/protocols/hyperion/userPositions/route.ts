import { NextResponse } from 'next/server';
import { sdk } from "@/lib/hyperion";

/**
 * @swagger
 * /api/protocols/hyperion/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Hyperion protocol
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
 *                       isActive:
 *                         type: boolean
 *                       value:
 *                         type: string
 *                       farm:
 *                         type: object
 *                       fees:
 *                         type: object
 *                       position:
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

    // Получаем позиции через локальный SDK
    const positions = await sdk.Position.fetchAllPositionsByAddress({
      address: address
    });
    
    // Возвращаем данные с настройками кэширования
    return NextResponse.json({
      success: true,
      data: positions
    }, {
      headers: {
        'Cache-Control': 'public, max-age=2, s-maxage=2, stale-while-revalidate=4',
        'Cdn-Cache-Control': 'max-age=2',
        'Surrogate-Control': 'max-age=2'
      }
    });
  } catch (error) {
    console.error("❌ Hyperion user positions error:", error);
    // Возвращаем пустой массив при ошибках (как в Echelon)
    return NextResponse.json(
      {
        success: true,
        data: []
      },
      { status: 200 }
    );
  }
} 