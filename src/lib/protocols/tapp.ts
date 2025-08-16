import { BaseProtocol } from "./BaseProtocol";

export class TappProtocol implements BaseProtocol {
  name = "Tapp Exchange";

  async buildDeposit(amountOctas: bigint, token: string, walletAddress?: string) {
    console.log('Tapp buildDeposit called with:', { amountOctas, token, walletAddress });
    
    // Tapp Exchange deposit transaction - пока не реализуем полностью
    throw new Error('Deposit not implemented for Tapp Exchange yet');
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string) {
    // Tapp Exchange withdraw transaction - пока не реализуем
    throw new Error('Withdraw not implemented for Tapp Exchange yet');
  }

  async buildClaimRewards(positionIds: string[], _tokenTypes: string[]): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: [string[], any[]];
  }> {
    // Tapp Exchange claim rewards transaction - пока не реализуем
    throw new Error('Claim rewards not implemented for Tapp Exchange yet');
  }
}
