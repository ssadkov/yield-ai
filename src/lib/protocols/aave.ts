import { BaseProtocol } from "./BaseProtocol";

export class AaveProtocol implements BaseProtocol {
  name = "Aave";

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string) {
    // Используем реальный адрес AAVE контракта
    return {
      type: 'entry_function_payload' as const,
      function: "0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb::supply_logic::supply",
      type_arguments: [] as string[],
      arguments: [
        token,                    // адрес токена
        amountOctas.toString(),   // количество в octas
        userAddress || "0x0000000000000000000000000000000000000000000000000000000000000000", // адрес пользователя
        "0"                      // referral code
      ]
    };
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string) {
    return {
      type: 'entry_function_payload' as const,
      function: "0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb::supply_logic::withdraw",
      type_arguments: [] as string[],
      arguments: [
        token,                    // адрес токена
        amountOctas.toString(),   // количество в octas
        userAddress || "0x0000000000000000000000000000000000000000000000000000000000000000" // адрес пользователя
      ]
    };
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string) {
    // AAVE пока не имеет rewards системы на Aptos
    // Возвращаем placeholder payload для удовлетворения интерфейса
    return {
      type: 'entry_function_payload' as const,
      function: "0x39ddcd9e1a39fa14f25e3f9ec8a86074d05cc0881cbf667df8a6ee70942016fb::placeholder::claim_rewards",
      type_arguments: [] as string[],
      arguments: [positionIds.join(','), tokenTypes.join(','), userAddress || ""]
    };
  }
}
