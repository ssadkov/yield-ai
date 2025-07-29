import { ProtocolService, Pool, UserPosition } from '../base/types';
import { sdk } from "@/lib/hyperion";

export class HyperionPoolsService implements ProtocolService {
  async getPools(): Promise<Pool[]> {
    // TODO: Implement Hyperion pools logic
    return [];
  }

  async getUserPositions(_userAddress: string): Promise<UserPosition[]> {
    // TODO: Implement Hyperion user positions logic
    return [];
  }
}

export async function getRemoveLiquidityPayload({ positionId, currencyA, currencyB, accountAddress }: {
  positionId: string;
  currencyA: string;
  currencyB: string;
  accountAddress: string;
}) {
  // Получаем amounts для позиции
  const [currencyAAmount, currencyBAmount] = await sdk.Position.fetchTokensAmountByPositionId({ positionId });
  // Получаем всю ликвидность (Remove All)
  const position = await sdk.Position.fetchPositionById({ positionId, address: accountAddress });
  const deltaLiquidity = position[0]?.currentAmount || position[0]?.currentAmout || 0;
  // Формируем параметры для remove
  const params = {
    positionId,
    currencyA,
    currencyB,
    currencyAAmount,
    currencyBAmount,
    deltaLiquidity,
    slippage: 0.1, // 0.1%
    recipient: accountAddress,
  };
  // Получаем payload для транзакции
  return sdk.Position.removeLiquidityTransactionPayload(params);
} 