import { NextResponse } from 'next/server';

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

    // Получаем данные из внешнего API
    const externalApiUrl = `https://yield-a.vercel.app/api/hyperion/userPositions?address=${address}`;
    const response = await fetch(externalApiUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`External API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error("Error fetching Hyperion user positions:", error);
    return NextResponse.json(
      { error: "Failed to fetch user positions" },
      { status: 500 }
    );
  }
} 