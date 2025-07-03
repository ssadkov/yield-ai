import { NextRequest, NextResponse } from 'next/server';
import { AptosApiService } from '@/lib/services/aptos/api';
import { PanoraPricesService } from '@/lib/services/panora/prices';
import { createErrorResponse, createSuccessResponse } from '@/lib/utils/http';
import { FungibleAssetBalance } from '@/lib/types/aptos';
import { TokenPrice } from '@/lib/types/panora';

interface PortfolioToken {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  amount: string;
  price: string | null;
  value: string | null;
}

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

    console.log('Getting portfolio for address:', address);
    
    // Use the same approach as walletBalance endpoint
    const apiService = new AptosApiService();
    const walletData = await apiService.getBalances(address);
    console.log('Wallet data:', walletData);
    
    const balances = walletData.balances;

    if (!balances.length) {
      console.log('No balances found');
      return NextResponse.json({ tokens: [] });
    }

    // Get prices for all tokens
    const pricesService = PanoraPricesService.getInstance();
    const tokenAddresses = balances.map((balance: FungibleAssetBalance) => balance.asset_type);
    console.log('Token addresses:', tokenAddresses);

    const pricesResponse = await pricesService.getPrices(1, tokenAddresses);
    console.log('Prices response:', pricesResponse);
    const prices = pricesResponse.data;

    // Combine data
    const tokens: PortfolioToken[] = balances.map((balance: FungibleAssetBalance) => {
      const price = prices.find((p: TokenPrice) => 
        p.tokenAddress === balance.asset_type || 
        p.faAddress === balance.asset_type
      );
      
      // If no price, use default values
      if (!price) {
        console.log('No price found for token:', balance.asset_type);
        return {
          address: balance.asset_type,
          name: balance.asset_type.split('::').pop() || balance.asset_type,
          symbol: balance.asset_type.split('::').pop() || balance.asset_type,
          decimals: 8, // default value
          amount: balance.amount,
          price: null,
          value: null
        };
      }

      // Calculate value with decimals
      const amount = parseFloat(balance.amount) / Math.pow(10, price.decimals);
      const value = (amount * parseFloat(price.usdPrice)).toString();

      return {
        address: balance.asset_type,
        name: price.name,
        symbol: price.symbol,
        decimals: price.decimals,
        amount: balance.amount,
        price: price.usdPrice,
        value
      };
    });

    // Sort by value
    tokens.sort((a, b) => {
      const valueA = a.value ? parseFloat(a.value) : 0;
      const valueB = b.value ? parseFloat(b.value) : 0;
      return valueB - valueA;
    });

    console.log('Final sorted tokens:', tokens);
    return NextResponse.json({ tokens });
  } catch (error) {
    console.error("Error fetching portfolio:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
} 