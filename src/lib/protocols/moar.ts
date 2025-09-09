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
    // For Moar Market, we claim individual rewards
    // positionIds contains farming_identifiers
    // tokenTypes contains reward_ids
    
    if (positionIds.length !== 1 || tokenTypes.length !== 1) {
      throw new Error('Moar Market supports only individual reward claims');
    }
    
    const farmingIdentifier = positionIds[0];
    const rewardId = tokenTypes[0];
    
    return {
      type: 'entry_function_payload',
      function: '0xa3afc59243afb6deeac965d40b25d509bb3aebc12f502b8592c283070abc2e07::farming::claim_reward_entry',
      type_arguments: [],
      arguments: [rewardId, farmingIdentifier]
    };
  }
}
