export interface TokenDragData {
  type: 'token';
  symbol: string;
  amount: string;
  address: string;
  price: string;
  value: string;
  decimals: number;
  logoUrl?: string;
}

export interface PositionDragData {
  type: 'position';
  positionId: string;
  asset: string;
  amount: string;
  positionType: 'lend' | 'borrow' | 'liquidity';
  protocol: string;
  // Поля для Echelon
  market?: string;
  supply?: string;
  tokenInfo?: {
    symbol: string;
    logoUrl?: string;
    decimals: number;
    usdPrice?: string;
  };
  // Поля для Hyperion
  poolId?: string;
  token1Info?: {
    symbol: string;
    logoUrl?: string;
    decimals: number;
    address: string;
  };
  token2Info?: {
    symbol: string;
    logoUrl?: string;
    decimals: number;
    address: string;
  };
  isActive?: boolean;
  value?: string;
}

export type DragData = TokenDragData | PositionDragData;

export interface DropValidationResult {
  isValid: boolean;
  reason?: string;
  requiresSwap?: boolean;
  action?: 'deposit' | 'withdraw' | 'removeLiquidity';
}

export interface DragDropState {
  isDragging: boolean;
  dragData: DragData | null;
  validationResult: DropValidationResult | null;
} 