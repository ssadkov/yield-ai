import { Pool, ProtocolService } from '../base/types';

export class HyperionPoolsService implements ProtocolService {
  async getPools(): Promise<Pool[]> {
    // TODO: Implement Hyperion pools logic
    return [];
  }

  async getUserPositions(userAddress: string): Promise<Pool[]> {
    // TODO: Implement Hyperion user positions logic
    return [];
  }
} 