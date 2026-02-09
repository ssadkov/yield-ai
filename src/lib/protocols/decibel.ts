import { BaseProtocol } from './BaseProtocol';

export class DecibelProtocol implements BaseProtocol {
  name = 'Decibel';

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    throw new Error('Decibel deposits are handled externally');
  }

  async buildWithdraw?(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    throw new Error('Decibel withdrawals are handled externally');
  }

  async buildClaimRewards?(positionIds: string[], tokenTypes: string[], userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: unknown;
  }> {
    throw new Error('Decibel reward claims are handled externally');
  }
}
