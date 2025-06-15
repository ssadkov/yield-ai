import { NextResponse } from 'next/server';
import { EchelonProtocol } from '@/lib/protocols/echelon';

/**
 * @swagger
 * /api/protocols/echelon/deposit:
 *   post:
 *     tags:
 *       - protocols
 *     summary: Deposit tokens to Echelon protocol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               token:
 *                 type: string
 *               amount:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deposit transaction payload generated successfully
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
    const { token, amount } = await request.json();

    if (!token || !amount) {
      return NextResponse.json(
        { error: "Token and amount are required" },
        { status: 400 }
      );
    }

    const protocol = new EchelonProtocol();
    const payload = await protocol.buildDeposit(BigInt(amount), token);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error generating deposit payload:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("Market not found")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to generate deposit payload" },
      { status: 500 }
    );
  }
} 