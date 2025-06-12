import { AptosWalletService } from './wallet';
import { PanoraPricesService } from '../panora/prices';
import { FungibleAssetBalance } from '../../types/aptos';
import { TokenPrice } from '../../types/panora';

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
    // Получаем балансы из кошелька
    const walletData = await this.walletService.getBalances(address);
    const balances = walletData.balances;

    // Собираем адреса токенов
    const tokenAddresses = balances.map((balance: FungibleAssetBalance) => balance.asset_type);

    // Получаем цены для всех токенов одним запросом
    const pricesResponse = await this.pricesService.getPrices(1, tokenAddresses);
    const prices = pricesResponse.data;

    // Объединяем данные
    const tokens: PortfolioToken[] = balances.map((balance: FungibleAssetBalance) => {
      const price = prices.find((p: TokenPrice) => 
        p.tokenAddress === balance.asset_type || 
        p.faAddress === balance.asset_type
      );
      
      // Если нет цены, используем дефолтные значения
      if (!price) {
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

    return { tokens };
  }
} 