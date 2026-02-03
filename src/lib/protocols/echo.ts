import { BaseProtocol } from './BaseProtocol';

export class EchoProtocol implements BaseProtocol {
  name = 'Echo Protocol';

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    throw new Error('Echo Protocol deposits are handled externally');
  }

  async buildWithdraw?(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    throw new Error('Echo Protocol withdrawals are handled externally');
  }

  async buildClaimRewards?(positionIds: string[], tokenTypes: string[], userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: any;
  }> {
    throw new Error('Echo Protocol reward claims are handled externally');
  }
}
