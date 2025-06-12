import { AptosWalletService } from './wallet';
import { PanoraPricesService } from '../panora/prices';
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

export class AptosPortfolioService {
  private walletService: AptosWalletService;
  private pricesService: PanoraPricesService;

  constructor() {
    this.walletService = new AptosWalletService();
    this.pricesService = PanoraPricesService.getInstance();
  }

  async getPortfolio(address: string): Promise<{ tokens: PortfolioToken[] }> {
    try {
      console.log('Getting portfolio for address:', address);
      
      // Получаем балансы из кошелька
      const walletData = await this.walletService.getBalances(address);
      console.log('Wallet data:', walletData);
      const balances = walletData.balances;

      if (!balances.length) {
        console.log('No balances found');
        return { tokens: [] };
      }

      // Собираем адреса токенов
      const tokenAddresses = balances.map((balance: FungibleAssetBalance) => balance.asset_type);
      console.log('Token addresses:', tokenAddresses);

      // Получаем цены для всех токенов одним запросом
      const pricesResponse = await this.pricesService.getPrices(1, tokenAddresses);
      console.log('Prices response:', pricesResponse);
      const prices = pricesResponse.data;

      // Объединяем данные
      const tokens: PortfolioToken[] = balances.map((balance: FungibleAssetBalance) => {
        const price = prices.find((p: TokenPrice) => 
          p.tokenAddress === balance.asset_type || 
          p.faAddress === balance.asset_type
        );
        
        // Если нет цены, используем дефолтные значения
        if (!price) {
          console.log('No price found for token:', balance.asset_type);
          return {
            address: balance.asset_type,
            name: balance.asset_type.split('::').pop() || balance.asset_type,
            symbol: balance.asset_type.split('::').pop() || balance.asset_type,
            decimals: 8, // дефолтное значение
            amount: balance.amount,
            price: null,
            value: null
          };
        }

        // Вычисляем value с учетом decimals
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

      // Сортируем по значению
      tokens.sort((a, b) => {
        const valueA = a.value ? parseFloat(a.value) : 0;
        const valueB = b.value ? parseFloat(b.value) : 0;
        return valueB - valueA;
      });

      console.log('Final sorted tokens:', tokens);
      return { tokens };
    } catch (error) {
      console.error('Error in getPortfolio:', error);
      return { tokens: [] };
    }
  }
} 