import { BaseProtocol } from "./BaseProtocol";

export class KoFiProtocol implements BaseProtocol {
  name = "Kofi Finance";

  async buildDeposit(amountOctas: bigint, token: string, walletAddress?: string) {
    console.log('Kofi buildDeposit called with:', { amountOctas, token, walletAddress });
    
    // Check if it's APT token - use deposit_and_stake_entry function
    if (token === "0x1::aptos_coin::AptosCoin") {
      console.log('Building APT deposit payload for Kofi Finance...');
      
      const amountString = amountOctas.toString();
      
      console.log('Amount conversion:', { 
        original: amountOctas.toString(), 
        asString: amountString,
        bigintValue: amountOctas
      });
      
      const payload = {
        type: "entry_function_payload" as const,
        function: "0x2cc52445acc4c5e5817a0ac475976fbef966fedb6e30e7db792e10619c76181f::gateway::deposit_and_stake_entry",
        type_arguments: [],
        arguments: [
          amountString // Amount as string
        ]
      };
      
      console.log('Generated Kofi Finance payload:', payload);
      console.log('Arguments types:', payload.arguments.map(arg => ({ value: arg, type: typeof arg })));
      console.log('Arguments JSON:', JSON.stringify(payload.arguments));
      
      return payload;
    } else {
      throw new Error(`Unsupported token for Kofi Finance: ${token}`);
    }
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // Kofi Finance liquid staking withdraw transaction - пока не реализуем
    // Return a placeholder payload that will throw an error when used
    return {
      type: "entry_function_payload" as const,
      function: "0x2cc52445acc4c5e5817a0ac475976fbef966fedb6e30e7db792e10619c76181f::gateway::withdraw",
      type_arguments: [],
      arguments: []
    };
  }

  async buildClaimRewards(positionIds: string[], _tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }> {
    // Kofi Finance claim rewards transaction - пока не реализуем
    // Return a placeholder payload that will throw an error when used
    return {
      type: "entry_function_payload" as const,
      function: "0x2cc52445acc4c5e5817a0ac475976fbef966fedb6e30e7db792e10619c76181f::gateway::claim_rewards",
      type_arguments: [],
      arguments: [positionIds, _tokenTypes]
    };
  }
}
