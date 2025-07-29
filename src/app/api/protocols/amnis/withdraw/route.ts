import { NextResponse } from 'next/server';
import { AmnisProtocol } from '@/lib/protocols/amnis';

/**
 * @swagger
 * /api/protocols/amnis/withdraw:
 *   post:
 *     tags:
 *       - protocols
 *     summary: Unstake tokens from Amnis Finance protocol
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
 *         description: Unstake transaction payload generated successfully
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

    const protocol = new AmnisProtocol();
    const payload = await protocol.buildWithdraw("", BigInt(amount), token);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error generating unstake payload:", error);
    return NextResponse.json(
      { error: "Failed to generate unstake payload" },
      { status: 500 }
    );
  }
} 