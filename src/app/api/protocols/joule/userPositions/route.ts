import { NextRequest, NextResponse } from 'next/server';
import { createErrorResponse } from '@/lib/utils/http';

/**
 * @swagger
 * /api/protocols/joule/userPositions:
 *   get:
 *     tags:
 *       - protocols
 *     summary: Get user positions from Joule protocol
 *     description: Returns user positions including borrow and lend positions from Joule protocol
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User wallet address
 *         example: "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97"
 *     responses:
 *       200:
 *         description: User positions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userPositions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       positions_map:
 *                         type: object
 *                         properties:
 *                           data:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 key:
 *                                   type: string
 *                                   example: "1"
 *                                 value:
 *                                   type: object
 *                                   properties:
 *                                     borrow_positions:
 *                                       type: object
 *                                       properties:
 *                                         data:
 *                                           type: array
 *                                           items:
 *                                             type: object
 *                                             properties:
 *                                               key:
 *                                                 type: string
 *                                                 example: "0x1::aptos_coin::AptosCoin"
 *                                               value:
 *                                                 type: object
 *                                                 properties:
 *                                                   borrow_amount:
 *                                                     type: string
 *                                                     example: "117444352967"
 *                                                   coin_name:
 *                                                     type: string
 *                                                     example: "0x1::aptos_coin::AptosCoin"
 *                                                   interest_accumulated:
 *                                                     type: string
 *                                                     example: "204352967"
 *                                     lend_positions:
 *                                       type: object
 *                                       properties:
 *                                         data:
 *                                           type: array
 *                                           items:
 *                                             type: object
 *                                             properties:
 *                                               key:
 *                                                 type: string
 *                                                 example: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt"
 *                                               value:
 *                                                 type: string
 *                                                 example: "119881806209"
 *                                     position_name:
 *                                       type: string
 *                                       example: "Loop-Position"
 *                       user_position_ids:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["1", "2"]
 *       400:
 *         description: Address parameter is required
 *       500:
 *         description: Failed to fetch user positions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      console.error('Address is missing');
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    console.log('Fetching Joule positions for address:', address);
    const response = await fetch(`https://yield-a.vercel.app/api/joule/userPositions?address=${address}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'http://localhost:3000',
        'Referer': 'http://localhost:3000/'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Joule API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log('Joule positions received:', data);

    // Возвращаем сразу userPositions без обертки data
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in Joule positions route:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        createErrorResponse(error),
        { status: 500 }
      );
    }

    return NextResponse.json(
      createErrorResponse(new Error('Internal server error')),
      { status: 500 }
    );
  }
} 