import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDragDrop } from "@/contexts/DragDropContext";

interface ConfirmRemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
  position: any;
}

export function ConfirmRemoveModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  position
}: ConfirmRemoveModalProps) {
  const { closeAllModals } = useDragDrop();
  const token1Symbol = position?.position?.pool?.token1Info?.symbol || 'Token1';
  const token2Symbol = position?.position?.pool?.token2Info?.symbol || 'Token2';
  const positionValue = parseFloat(position?.value || "0").toFixed(2);
  const isActive = position?.isActive;

  console.log('ConfirmRemoveModal: Render', {
    isOpen,
    positionId: position?.position?.objectId,
    timestamp: new Date().toISOString()
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-red-600">Remove Liquidity</span>
          </DialogTitle>
          <div className="text-left space-y-3">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove all tokens from this position?
            </p>
            
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold">{token1Symbol} / {token2Symbol}</span>
                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                  isActive 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-foreground">
                Position value: <span className="font-semibold">${positionValue}</span>
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This will withdraw all tokens from the position to your wallet, 
                including any unclaimed rewards.
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              closeAllModals();
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? 'Removing...' : 'Remove All'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 