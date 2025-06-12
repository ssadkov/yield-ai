import { NextRequest, NextResponse } from 'next/server';
import { AptosApiService } from '@/lib/services/aptos/api';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { FungibleAssetBalance } from '@/lib/types/aptos';
import { TokenPrice } from '@/lib/types/panora';
import { AptosPortfolioService } from "@/lib/services/aptos/portfolio";

/**
 * @swagger
 * /api/aptos/portfolio:
 *   get:
 *     tags:
 *       - aptos
 *     summary: Get portfolio data for an Aptos address
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Aptos wallet address
 *     responses:
 *       200:
 *         description: Portfolio data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tokens:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       address:
 *                         type: string
 *                       name:
 *                         type: string
 *                       symbol:
 *                         type: string
 *                       decimals:
 *                         type: number
 *                       amount:
 *                         type: string
 *                       price:
 *                         type: string
 *                       value:
 *                         type: string
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

    const portfolioService = new AptosPortfolioService();
    const portfolio = await portfolioService.getPortfolio(address);

    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
} 