import { BaseProtocol } from "./BaseProtocol";

export class AuroProtocol implements BaseProtocol {
  name = "Auro Finance";

  async buildDeposit(amountOctas: bigint, token: string) {
    // TODO: Implement Auro Finance deposit transaction
    // This will need to be implemented based on Auro Finance's smart contract structure
    return {
      type: "entry_function_payload" as const,
      function: "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c::auro_pool::deposit",
      type_arguments: [token],
      arguments: [amountOctas.toString()]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // TODO: Implement Auro Finance withdraw transaction
    return {
      type: "entry_function_payload" as const,
      function: "0x50a340a19e6ada1be07192c042786ca6a9651d5c845acc8727e8c6416a56a32c::auro_pool::withdraw",
      type_arguments: [token],
      arguments: [marketAddress, amountOctas.toString()]
    };
  }

  async buildClaimRewards(positionIds: string[], _tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }> {
    // Захардкоженный массив type_arguments как в примере пользователя
    const type_arguments = Array(15).fill("0x1::aptos_coin::AptosCoin");
    return {
      type: "entry_function_payload" as const,
      function: "0xd039ef33e378c10544491855a2ef99cd77bf1a610fd52cc43117cd96e1c73465::auro_router::claim_rewards",
      type_arguments,
      arguments: [positionIds, []], // tuple
    };
  }

  async buildDepositToPosition(positionAddress: string, amountOctas: bigint, tokenType?: string) {
    // Определяем функцию на основе типа токена
    const isCustomToken = tokenType && tokenType.includes('::');
    const functionName = isCustomToken ? 'deposit_coin_entry' : 'deposit_entry';
    
    return {
      type: "entry_function_payload" as const,
      function: `0xd039ef33e378c10544491855a2ef99cd77bf1a610fd52cc43117cd96e1c73465::auro_router::${functionName}`,
      type_arguments: isCustomToken ? [tokenType] : [], // type_arguments только для кастомных токенов
      arguments: [positionAddress, amountOctas.toString()]
    };
  }

  async buildCreatePosition(poolAddress: string, amountOctas: bigint, tokenType?: string) {
    // Определяем функцию на основе типа токена
    const isCustomToken = tokenType && tokenType.includes('::');
    const functionName = isCustomToken ? 'create_position_coin_entry' : 'create_position_entry';
    
    return {
      type: "entry_function_payload" as const,
      function: `0xd039ef33e378c10544491855a2ef99cd77bf1a610fd52cc43117cd96e1c73465::auro_router::${functionName}`,
      type_arguments: isCustomToken ? [tokenType] : [], // type_arguments только для кастомных токенов
      arguments: [poolAddress, amountOctas.toString(), "0"] // "0" = no debt
    };
  }
} 