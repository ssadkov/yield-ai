import { BaseProtocol } from "./BaseProtocol";

export class EarniumProtocol implements BaseProtocol {
  name = "Earnium";

  async buildDeposit(amountOctas: bigint, token: string) {
    // Placeholder payload; replace with real Earnium entry function when available
    return {
      type: 'entry_function_payload' as const,
      function: "0xearnium::module::deposit",
      type_arguments: [],
      arguments: [amountOctas.toString(), token]
    };
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string) {
    console.log('[EarniumProtocol] Building claim rewards for:', { positionIds, tokenTypes, userAddress });

    // Earnium использует claim_all_rewards для всех пулов сразу
    // positionIds в данном случае - это индексы пулов (0, 1, 2, 3)
    // tokenTypes не используются для Earnium, так как claim_all_rewards забирает все награды
    
    if (!positionIds || positionIds.length === 0) {
      throw new Error('Pool indices are required for Earnium claims');
    }

    // Earnium contract address
    const functionAddress = '0x7c92a9636a412407aaede35eb2654d176477c00a47bc11ea3338d1f571ec95bc';
    
    return {
      type: 'entry_function_payload' as const,
      function: `${functionAddress}::premium_staked_pool::claim_all_rewards`,
      type_arguments: [],
      arguments: [positionIds] // positionIds содержит индексы пулов [0, 1, 2, 3]
    };
  }
}


