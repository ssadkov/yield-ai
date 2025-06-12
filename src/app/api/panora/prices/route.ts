import { NextRequest, NextResponse } from 'next/server';
import { http } from '@/lib/utils/http';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { PanoraPricesService } from "@/lib/services/panora/prices";

interface PanoraResponse {
  data: Array<{
    tokenAddress: string;
    faAddress: string;
    symbol: string;
    price: number;
  }>;
}

/**
 * @swagger
 * /api/panora/prices:
 *   get:
 *     tags:
 *       - panora
 *     summary: Get token prices from Panora
 *     parameters:
 *       - in: query
 *         name: chainId
 *         required: true
 *         schema:
 *           type: number
 *         description: Chain ID (1 for Aptos)
 *       - in: query
 *         name: addresses
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Array of token addresses
 *     responses:
 *       200:
 *         description: Prices retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       tokenAddress:
 *                         type: string
 *                       faAddress:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       name:
 *                         type: string
 *                       decimals:
 *                         type: number
 *                       price:
 *                         type: number
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Internal server error
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const chainId = searchParams.get("chainId");
    const addresses = searchParams.get("addresses");

    if (!chainId || !addresses) {
      return NextResponse.json(
        { error: "Chain ID and addresses are required" },
        { status: 400 }
      );
    }

    const pricesService = PanoraPricesService.getInstance();
    const response = await pricesService.getPrices(
      parseInt(chainId),
      addresses.split(",")
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching prices:", error);
    return NextResponse.json(
      { error: "Failed to fetch prices" },
      { status: 500 }
    );
  }
} 