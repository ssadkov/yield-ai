import { NextResponse } from 'next/server';
import { AmnisProtocol } from '@/lib/protocols/amnis';

/**
 * @swagger
 * /api/protocols/amnis/claim:
 *   post:
 *     tags:
 *       - protocols
 *     summary: Claim rewards from Amnis Finance protocol
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               positionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               tokenTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Claim rewards transaction payload generated successfully
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
 *                     type: array
 *       400:
 *         description: Invalid request parameters
 *       500:
 *         description: Internal server error
 */
export async function POST(request: Request) {
  try {
    const { positionIds, tokenTypes } = await request.json();

    if (!positionIds || !Array.isArray(positionIds)) {
      return NextResponse.json(
        { error: "positionIds array is required" },
        { status: 400 }
      );
    }

    const protocol = new AmnisProtocol();
    const payload = await protocol.buildClaimRewards(positionIds, tokenTypes || []);

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error generating claim rewards payload:", error);
    return NextResponse.json(
      { error: "Failed to generate claim rewards payload" },
      { status: 500 }
    );
  }
} 