import { BaseProtocol } from './BaseProtocol';

export class MoarMarketProtocol implements BaseProtocol {
  name = 'Moar Market';

  async buildDeposit(amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // TODO: Implement Moar Market deposit transaction building
    // This will be implemented once we have the Moar Market smart contract details
    
    throw new Error('Moar Market deposit not yet implemented');
  }

  async buildWithdraw(marketAddress: string, amountOctas: bigint, token: string, userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: string[];
  }> {
    // TODO: Implement Moar Market withdraw transaction building
    // This will be implemented once we have the Moar Market smart contract details
    
    throw new Error('Moar Market withdraw not yet implemented');
  }

  async buildClaimRewards(positionIds: string[], tokenTypes: string[], userAddress?: string): Promise<{
    type: 'entry_function_payload';
    function: string;
    type_arguments: string[];
    arguments: any;
  }> {
    // TODO: Implement Moar Market claim rewards transaction building
    // This will be implemented once we have the Moar Market smart contract details
    
    throw new Error('Moar Market claim rewards not yet implemented');
  }
}
