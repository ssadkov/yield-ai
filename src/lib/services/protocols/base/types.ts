export interface Pool {
  address: string;
  // TODO: Add pool properties
}

export interface UserPosition {
  address: string;
  // TODO: Add position properties
}

export interface ProtocolService {
  getPools(): Promise<Pool[]>;
  getUserPositions(userAddress: string): Promise<UserPosition[]>;
} 