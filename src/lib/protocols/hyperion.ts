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