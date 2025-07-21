import { BaseProtocol } from "./BaseProtocol";

export class AmnisProtocol implements BaseProtocol {
  name = "Amnis Finance";

  async buildDeposit(amountOctas: bigint, token: string, walletAddress?: string) {
    console.log('Amnis buildDeposit called with:', { amountOctas, token, walletAddress });
    
    // Check if it's APT token - use deposit_and_stake_entry function
    if (token === "0x1::aptos_coin::AptosCoin") {
      console.log('Building APT deposit payload...');
      
      const amountString = amountOctas.toString();
      const finalWalletAddress = walletAddress || "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97";
      
      console.log('Amount conversion:', { 
        original: amountOctas.toString(), 
        asString: amountString,
        bigintValue: amountOctas
      });
      console.log('Wallet address:', finalWalletAddress);
      
      const payload = {
        type: "entry_function_payload" as const,
        function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::deposit_and_stake_entry",
        type_arguments: [],
        arguments: [
          amountString, // Amount as string
          finalWalletAddress // Wallet address as string
        ]
      };
      
      console.log('Generated APT payload:', payload);
      console.log('Arguments types:', payload.arguments.map(arg => ({ value: arg, type: typeof arg })));
      console.log('Arguments JSON:', JSON.stringify(payload.arguments));
      
      return payload;
    } 
    // Check if it's amAPT token - use stake_entry function
    else if (token === "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt") {
      console.log('Building amAPT deposit payload...');
      
      const amountString = amountOctas.toString();
      const finalWalletAddress = walletAddress || "0x56ff2fc971deecd286314fe99b8ffd6a5e72e62eacdc46ae9b234c5282985f97";
      
      console.log('Amount conversion:', { 
        original: amountOctas.toString(), 
        asString: amountString,
        bigintValue: amountOctas
      });
      console.log('Wallet address:', finalWalletAddress);
      
      const payload = {
        type: "entry_function_payload" as const,
        function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::router::stake_entry",
        type_arguments: [],
        arguments: [
          amountString, // Amount as string
          finalWalletAddress // Wallet address as string
        ]
      };
      
      console.log('Generated amAPT payload:', payload);
      console.log('Arguments types:', payload.arguments.map(arg => ({ value: arg, type: typeof arg })));
      console.log('Arguments JSON:', JSON.stringify(payload.arguments));
      
      return payload;
    } else {
      // For other tokens, use the original stake function
      return {
        type: "entry_function_payload" as const,
        function: "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stake::stake",
        type_arguments: [token],
        arguments: [amountOctas.toString()]
      };
    }
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