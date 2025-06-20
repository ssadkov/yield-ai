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
  positionType: 'lend' | 'borrow';
  protocol: string;
}

export type DragData = TokenDragData | PositionDragData;

export interface DropValidationResult {
  isValid: boolean;
  reason?: string;
  requiresSwap?: boolean;
}

export interface DragDropState {
  isDragging: boolean;
  dragData: DragData | null;
  validationResult: DropValidationResult | null;
} 