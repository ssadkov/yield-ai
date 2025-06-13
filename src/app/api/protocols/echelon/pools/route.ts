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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       poolId:
 *                         type: string
 *                       assetName:
 *                         type: string
 *                       assetInfo:
 *                         type: object
 *                       supplyApy:
 *                         type: string
 *                       borrowApy:
 *                         type: string
 *                       totalSupply:
 *                         type: string
 *                       totalBorrow:
 *                         type: string
 *       500:
 *         description: Internal server error
 */
export async function GET() {
  try {
    // Получаем данные из внешнего API
    // TODO: Заменить на реальный эндпоинт Echelon API, когда он будет доступен
    const externalApiUrl = "https://yield-a.vercel.app/api/echelon/pools";
    const response = await fetch(externalApiUrl);
    
    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching Echelon pools:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch pools",
        // Временные заглушки для разработки
        data: [
          {
            poolId: "0x1::coin::AptosCoin",
            assetName: "APT",
            assetInfo: {
              name: "Aptos",
              symbol: "APT",
              decimals: 8
            },
            supplyApy: "3.5",
            borrowApy: "5.2",
            totalSupply: "1250000",
            totalBorrow: "750000"
          },
          {
            poolId: "0x1::coin::USDC",
            assetName: "USDC",
            assetInfo: {
              name: "USD Coin",
              symbol: "USDC",
              decimals: 6
            },
            supplyApy: "4.2",
            borrowApy: "6.1",
            totalSupply: "5000000",
            totalBorrow: "2500000"
          }
        ]
      },
      { status: 500 }
    );
  }
} 