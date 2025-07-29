import { NextResponse } from 'next/server';
import { EchelonProtocol } from '@/lib/protocols/echelon';

/**
 * @swagger
 * /api/protocols/echelon/withdraw:
 *   post:
 *     tags:
 *       - protocols
 *     summary: Generate withdraw transaction payload for Echelon protocol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               marketAddress:
 *                 type: string
 *               amount:
 *                 type: string
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdraw transaction payload generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 type:
 *                   type: string
 *                 function:
 *                   type: string
 *                 type_arguments:
 *                   type: array
 *                   items:
 *                     type: string
 *                 arguments:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
export async function POST(request: Request) {
  try {
    const { marketAddress, amount, token } = await request.json();

    if (!marketAddress || !amount || !token) {
      return NextResponse.json(
        { error: "Market address, amount and token are required" },
        { status: 400 }
      );
    }

    const protocol = new EchelonProtocol();
    const payload = await protocol.buildWithdraw(marketAddress, BigInt(amount), token);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error generating withdraw payload:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("Market not found")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate withdraw payload" },
      { status: 500 }
    );
  }
} 