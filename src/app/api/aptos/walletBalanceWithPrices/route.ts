import { NextRequest, NextResponse } from 'next/server';
import { AptosWalletService } from '@/lib/services/aptos/wallet';
import { http } from '@/lib/utils/http';

interface TokenInfo {
  symbol: string;
  decimals: number;
}

const TOKEN_INFO: Record<string, TokenInfo> = {
  '0x1::aptos_coin::AptosCoin': { symbol: 'APT', decimals: 8 },
  '0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt': { symbol: 'stAPT', decimals: 8 },
  '0x50788befc1107c0cc4473848a92e5c783c635866ce3c98de71d2eeb7d2a34f85::aptos_coin::AptosCoin': { symbol: 'amAPT', decimals: 8 },
  '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b': { symbol: 'amAPT', decimals: 8 },
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Address parameter is required' },
        { status: 400 }
      );
    }

    // Получаем балансы
    const walletService = AptosWalletService.getInstance();
    const { balances } = await walletService.getBalances(address);

    // Получаем цены токенов
    const prices = await http.get<Record<string, number>>(
      `${process.env.PANORA_API_URL}/prices`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.PANORA_API_KEY}`,
        }
      }
    );

    // Обрабатываем балансы
    const balancesWithPrices = balances.map((balance: { asset_type: string; amount: string }) => {
      const tokenInfo = TOKEN_INFO[balance.asset_type] || { symbol: balance.asset_type, decimals: 8 };
      const amount = Number(balance.amount) / Math.pow(10, tokenInfo.decimals);
      const usdPrice = prices[tokenInfo.symbol];
      
      return {
        ...balance,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        amount,
        usdValue: usdPrice ? amount * usdPrice : undefined
      };
    });

    return NextResponse.json({ 
      data: { balances: balancesWithPrices }, 
      status: 200 
    });
  } catch (error) {
    console.error('Error fetching wallet balance with prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet balance with prices' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { address } = await request.json();
    const walletService = AptosWalletService.getInstance();
    // ... rest of the code ...
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 