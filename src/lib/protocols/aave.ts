import { BaseProtocol } from "./BaseProtocol";

export class AaveProtocol implements BaseProtocol {
  name = "Aave";

  async buildDeposit(amountOctas: bigint, token: string) {
    // TODO: Implement AAVE deposit functionality
    // For now, return placeholder payload
    return {
      type: 'entry_function_payload' as const,
      function: "0xplaceholder::aave::deposit",
      type_arguments: [],
      arguments: [amountOctas.toString(), token]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // TODO: Implement AAVE withdraw functionality
    // For now, return placeholder payload
    return {
      type: 'entry_function_payload' as const,
      function: "0xplaceholder::aave::withdraw",
      type_arguments: [],
      arguments: [marketAddress, amountOctas.toString(), token]
    };
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string) {
    // AAVE doesn't have rewards system on Aptos yet
    // Return placeholder payload to satisfy interface
    return {
      type: 'entry_function_payload' as const,
      function: "0xplaceholder::aave::claim_rewards",
      type_arguments: [],
      arguments: [positionIds, tokenTypes, userAddress || ""]
    };
  }
}
