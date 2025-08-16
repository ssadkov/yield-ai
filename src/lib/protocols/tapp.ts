import { BaseProtocol } from "./BaseProtocol";

export class TappProtocol implements BaseProtocol {
  name = "Tapp Exchange";

  async buildDeposit(amountOctas: bigint, token: string, walletAddress?: string) {
    console.log('Tapp buildDeposit called with:', { amountOctas, token, walletAddress });
    
    // Tapp Exchange deposit transaction - пока не реализуем полностью
    // Return a placeholder payload that will throw an error when used
    return {
      type: "entry_function_payload" as const,
      function: "0x1::coin::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // Tapp Exchange withdraw transaction - пока не реализуем
    // Return a placeholder payload that will throw an error when used
    return {
      type: "entry_function_payload" as const,
      function: "0x1::coin::withdraw",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }

  async buildClaimRewards(positionIds: string[], _tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }> {
    // Tapp Exchange claim rewards transaction - пока не реализуем
    // Return a placeholder payload that will throw an error when used
    return {
      type: "entry_function_payload" as const,
      function: "0x1::coin::claim_rewards",
      type_arguments: [],
      arguments: [positionIds, _tokenTypes]
    };
  }
}
