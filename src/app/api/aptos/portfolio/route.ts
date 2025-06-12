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
  value: number | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        createErrorResponse(new Error('Address parameter is required')),
        { status: 400 }
      );
    }

    // Получаем балансы
    const apiService = new AptosApiService();
    const walletData = await apiService.getBalances(address);
    const balances = walletData.balances;

    if (!balances.length) {
      return NextResponse.json(createSuccessResponse({ tokens: [] }));
    }

    // Получаем цены
    const pricesService = PanoraPricesService.getInstance();
    const tokenAddresses = balances.map((balance: FungibleAssetBalance) => balance.asset_type);
    console.log('Getting prices for addresses:', tokenAddresses);
    
    const pricesResponse = await pricesService.getPrices(1, tokenAddresses);
    console.log('Prices response:', pricesResponse);
    const prices = pricesResponse.data;
    console.log('Prices data:', prices);

    // Объединяем данные
    const tokens: PortfolioToken[] = balances.map((balance: FungibleAssetBalance) => {
      const price = prices.find((p: TokenPrice) => {
        const matches = p.tokenAddress === balance.asset_type || p.faAddress === balance.asset_type;
        if (matches) {
          console.log('Found price for token:', {
            token: balance.asset_type,
            price: p
          });
        }
        return matches;
      });
      
      if (!price) {
        console.log('No price found for token:', balance.asset_type);
        return {
          address: balance.asset_type,
          name: balance.asset_type.split('::').pop() || balance.asset_type,
          symbol: balance.asset_type.split('::').pop() || balance.asset_type,
          decimals: 8,
          amount: balance.amount,
          price: null,
          value: null
        };
      }

      const amount = Number(balance.amount) / Math.pow(10, 8);
      const value = amount * price.price;

      console.log('Token calculation:', {
        symbol: price.symbol,
        price: price.price,
        amount: balance.amount,
        amountConverted: amount,
        value: value
      });

      return {
        address: balance.asset_type,
        name: balance.asset_type.split('::').pop() || balance.asset_type,
        symbol: price.symbol,
        decimals: 8,
        amount: balance.amount,
        price: price.price.toString(),
        value: isNaN(value) ? null : value
      };
    });

    // Сортируем по значению
    tokens.sort((a, b) => {
      console.log('Comparing tokens:', {
        a: { symbol: a.symbol, price: a.price, value: a.value },
        b: { symbol: b.symbol, price: b.price, value: b.value }
      });

      if (!a.value && !b.value) return 0;
      if (!a.value) return 1;
      if (!b.value) return -1;
      return b.value - a.value;
    });

    console.log('Final sorted tokens:', tokens.map(t => ({ 
      symbol: t.symbol,
      price: t.price,
      amount: t.amount,
      value: t.value 
    })));

    return NextResponse.json(createSuccessResponse({ tokens }));
  } catch (error) {
    console.error('Error in portfolio route:', error);
    
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