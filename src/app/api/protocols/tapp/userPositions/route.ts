import { NextResponse } from 'next/server';

/**
 * @swagger
 * /api/protocols/tapp/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions in Tapp Exchange protocol
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
 *                       positionAddr:
 *                         type: string
 *                       poolId:
 *                         type: string
 *                       poolType:
 *                         type: string
 *                       feeTier:
 *                         type: string
 *                       tvl:
 *                         type: string
 *                       volume24h:
 *                         type: string
 *                       shareOfPool:
 *                         type: string
 *                       apr:
 *                         type: object
 *                       initialDeposits:
 *                         type: array
 *                       estimatedWithdrawals:
 *                         type: array
 *                       totalEarnings:
 *                         type: array
 *                       estimatedIncentives:
 *                         type: array
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

    // Создаем JSON-RPC запрос к Tapp API
    const tappApiUrl = "https://api.tapp.exchange/api/v1";
    const requestBody = {
      method: "public/position",
      jsonrpc: "2.0",
      id: 3,
      params: {
        query: {
          userAddr: address,
          page: 1,
          pageSize: 100
        }
      }
    };

    const response = await fetch(tappApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': request.headers.get('origin') || request.headers.get('host') || 'https://yield-ai.vercel.app',
        'Referer': request.headers.get('referer') || `https://${request.headers.get('host') || 'yield-ai.vercel.app'}/`
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`Tapp API returned ${response.status}`);
    }

    const data = await response.json();

    // Проверяем структуру ответа
    if (!data.result || !data.result.data) {
      return NextResponse.json({ success: true, data: [] });
    }

    const formattedData = {
      success: true,
      data: data.result.data || [],
    };

    return NextResponse.json(formattedData);
  } catch (error) {
    console.error("Error fetching Tapp user positions:", error);
    return NextResponse.json(
      {
        success: true,
        data: []
      },
      { status: 200 }
    );
  }
} 