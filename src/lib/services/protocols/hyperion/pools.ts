import { ProtocolService, Pool, UserPosition } from '../base/types';

export class HyperionPoolsService implements ProtocolService {
  async getPools(): Promise<Pool[]> {
    // TODO: Implement Hyperion pools logic
    return [];
  }

  async getUserPositions(_userAddress: string): Promise<UserPosition[]> {
    // TODO: Implement Hyperion user positions logic
    return [];
  }
} 