import { BaseProtocol } from "./BaseProtocol";

export class AaveProtocol implements BaseProtocol {
  name = "Aave";

  async buildDeposit(amountOctas: bigint, token: string) {
    // Placeholder payload; replace with real Aave entry function when available
    return {
      type: 'entry_function_payload' as const,
      function: "0xaave::module::deposit",
      type_arguments: [],
      arguments: [amountOctas.toString(), token]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // Placeholder payload; replace with real Aave entry function when available
    return {
      type: 'entry_function_payload' as const,
      function: "0xaave::module::withdraw",
      type_arguments: [],
      arguments: [marketAddress, amountOctas.toString(), token]
    };
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string) {
    // Placeholder payload; replace with real Aave entry function when available
    return {
      type: 'entry_function_payload' as const,
      function: "0xaave::module::claim_rewards",
      type_arguments: [],
      arguments: [positionIds, tokenTypes, userAddress || ""]
    };
  }
}
