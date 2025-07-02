import { NextResponse } from 'next/server';
import echelonMarkets from '@/lib/data/echelonMarkets.json';

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
    console.log('Fetching from external API:', externalApiUrl);
    
    const response = await fetch(externalApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/'
      }
    });
    
    console.log('External API response status:', response.status);
    console.log('External API response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('External API error response:', errorText);
      console.log('Returning empty data due to external API error');
      return NextResponse.json(
        {
          success: true,
          data: []
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    console.log('Echelon API response:', data);

    // Получаем market data для сопоставления coin с market address
    let marketData: { marketData: any[] } = { marketData: [] };
    
    try {
      const marketResponse = await fetch('https://yield-a.vercel.app/api/echelon/markets');
      console.log('Market API response status:', marketResponse.status);
      
      if (marketResponse.ok) {
        marketData = await marketResponse.json();
        console.log('Echelon API - marketData loaded successfully from external API');
      } else {
        const marketErrorText = await marketResponse.text();
        console.error('Market API error response:', marketErrorText);
        console.log('Using local market data due to API error');
        marketData = { marketData: echelonMarkets.markets };
      }
    } catch (error) {
      console.error('Market API fetch error:', error);
      console.log('Using local market data due to fetch error');
      marketData = { marketData: echelonMarkets.markets };
    }
    
    console.log('Echelon API - final marketData length:', marketData.marketData.length);

    // Преобразуем данные в нужный формат и добавляем market address
    const formattedPositions = (data.userPositions || []).map((position: any) => {
      const market = (marketData.marketData as any[])?.find((m: any) => m.coin === position.coin);
      console.log('Echelon API - position:', position.coin, 'found market:', market?.market);
      return {
        ...position,
        market: market?.market || null
      };
    });
    console.log('Echelon API - formattedPositions:', formattedPositions);

    const formattedData = {
      success: true,
      data: formattedPositions
    };

    return NextResponse.json(formattedData);
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