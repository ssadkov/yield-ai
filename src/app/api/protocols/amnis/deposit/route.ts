import { NextResponse } from 'next/server';
import { AmnisProtocol } from '@/lib/protocols/amnis';

/**
 * @swagger
 * /api/protocols/amnis/deposit:
 *   post:
 *     tags:
 *       - protocols
 *     summary: Stake tokens to Amnis Finance protocol
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
 *         description: Stake transaction payload generated successfully
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
    const { token, amount, walletAddress } = await request.json();
    
    console.log('API received:', { token, amount, walletAddress });

    if (!token || !amount) {
      return NextResponse.json(
        { error: "Token and amount are required" },
        { status: 400 }
      );
    }

    const protocol = new AmnisProtocol();
    
    // Use the updated protocol method that handles wallet address
    const payload = await protocol.buildDeposit(BigInt(amount), token, walletAddress);
    
    console.log('Generated payload:', payload);
    console.log('Arguments types:', payload.arguments.map(arg => ({ value: arg, type: typeof arg })));
    console.log('Arguments JSON:', JSON.stringify(payload.arguments));
    
    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error generating stake payload:", error);
    return NextResponse.json(
      { error: "Failed to generate stake payload" },
      { status: 500 }
    );
  }
} 