"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

interface BridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BridgeModal({ isOpen, onClose }: BridgeModalProps) {
  // Simple iframe with official Wormhole Bridge
  // This avoids all styling conflicts and dependency issues
  const iframeUrl = 'https://portalbridge.com/#/transfer';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden p-0">
        <DialogTitle className="sr-only">Bridge USDC</DialogTitle>
        <iframe
          src={iframeUrl}
          className="w-full h-full min-h-[600px] border-0"
          title="Wormhole Bridge"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
        />
      </DialogContent>
    </Dialog>
  );
}

