"use client";

import { useEffect } from "react";

interface PositionsListProps {
  address?: string;
  onPositionsValueChange?: (value: number) => void;
  refreshKey?: number;
  onPositionsCheckComplete?: () => void;
  showManageButton?: boolean;
}

export function PositionsList({
  address,
  onPositionsValueChange,
  refreshKey,
  onPositionsCheckComplete,
}: PositionsListProps) {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!address) {
        onPositionsValueChange?.(0);
        onPositionsCheckComplete?.();
        return;
      }

      try {
        await fetch(`/api/protocols/aptree/userPositions?address=${encodeURIComponent(address)}`);
      } catch {
        // Keep tracker resilient: Aptree user positions are optional for now.
      } finally {
        if (!cancelled) {
          onPositionsValueChange?.(0);
          onPositionsCheckComplete?.();
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [address, refreshKey, onPositionsValueChange, onPositionsCheckComplete]);

  return null;
}
