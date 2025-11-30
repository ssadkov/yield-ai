import { BaseProtocol } from './BaseProtocol';

export class ThalaProtocol implements BaseProtocol {
  name = 'Thala';

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // TODO: Implement deposit transaction for Thala protocol
    // Thala is currently external-only, so this method may not be used
    throw new Error('Thala protocol deposits are handled externally');
  }

  async buildWithdraw?(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // TODO: Implement withdraw transaction for Thala protocol
    // Thala is currently external-only, so this method may not be used
    throw new Error('Thala protocol withdrawals are handled externally');
  }

  async buildClaimRewards?(positionIds: string[], tokenTypes: string[], userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: any;
  }> {
    // TODO: Implement claim rewards transaction for Thala protocol
    // Thala is currently external-only, so this method may not be used
    throw new Error('Thala protocol reward claims are handled externally');
  }
}

