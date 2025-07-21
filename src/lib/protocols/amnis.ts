import { BaseProtocol } from "./BaseProtocol";

export class AmnisProtocol implements BaseProtocol {
  name = "Amnis Finance";

  async buildDeposit(amountOctas: bigint, token: string) {
    // Amnis Finance liquid staking deposit transaction
    return {
      type: "entry_function_payload" as const,
      function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stake::stake",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // Amnis Finance liquid staking withdraw transaction
    return {
      type: "entry_function_payload" as const,
      function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stake::unstake",
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
    // Amnis Finance claim rewards transaction
    return {
      type: "entry_function_payload" as const,
      function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stake::claim_rewards",
      type_arguments: [],
      arguments: [positionIds, []]
    };
  }
} 