import { BaseProtocol } from "./BaseProtocol";
import { TransactionPayload } from "@aptos-labs/ts-sdk";

export class HyperionProtocol implements BaseProtocol {
  name = "Hyperion";

  async buildDeposit(amountOctas: bigint, token: string) {
    return {
      type: "entry_function_payload" as const,
      function: "0x9770fa9c725cbd97eb50b2be5f0366fd55a3f90c9b6f8c425c5d6c2d6f3f3f3f::lending::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string) {
    console.log('Building Hyperion Goblin Vault withdraw for:', { marketAddress, amountOctas, token, userAddress });

    // For Goblin Vaults: marketAddress is the vault token address (poolId)
    // amountOctas is the amount of vault tokens to withdraw
    return {
      type: "entry_function_payload" as const,
      function: "0x19bcbcf8e688fd5ddf52725807bc8bf455a76d4b5a6021cfdc4b5b2652e5cd55::vaults::remove_as_pair",
      type_arguments: [], // Empty type arguments for remove_as_pair
      arguments: [
        marketAddress, // poolId (vault token address)
        amountOctas.toString() // amount of vault tokens to withdraw
      ]
    };
  }

  async buildClaimRewards(positionIds: string[], _tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }> {
    // Hyperion не поддерживает batch claim, берем только первый positionId
    const positionId = positionIds[0] || '';
    return {
      type: "entry_function_payload" as const,
      function: "0x9770fa9c725cbd97eb50b2be5f0366fd55a3f90c9b6f8c425c5d6c2d6f3f3f3f::farming::claim_rewards",
      type_arguments: [],
      arguments: [[positionId], []] // оборачиваем в массив для совместимости
    };
  }
} 