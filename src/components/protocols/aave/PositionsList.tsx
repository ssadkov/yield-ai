import { useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { ProtocolCard } from "@/shared/ProtocolCard";
import { useAavePositions } from "@/lib/query/hooks/protocols/aave";
import { queryKeys } from "@/lib/query/queryKeys";
import { mapAavePositionsToProtocolPositions } from "./mapAaveToProtocolPositions";

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
  showManageButton = true,
}: PositionsListProps) {
  const { account } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = address || account?.address?.toString();
  const protocol = getProtocolByName("Aave");

  const onValueRef = useRef(onPositionsValueChange);
  const onCompleteRef = useRef(onPositionsCheckComplete);
  onValueRef.current = onPositionsValueChange;
  onCompleteRef.current = onPositionsCheckComplete;

  const {
    data: positions = [],
    isLoading,
    error,
  } = useAavePositions(walletAddress);

  const hasError = Boolean(error);

  const totalValue = useMemo(
    () =>
      positions.reduce(
        (sum, position) =>
          sum +
          (position.deposit_value_usd || 0) -
          (position.borrow_value_usd || 0),
        0
      ),
    [positions]
  );

  const protocolPositions = useMemo(
    () => mapAavePositionsToProtocolPositions(positions),
    [positions]
  );

  useEffect(() => {
    if (refreshKey != null && walletAddress) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.protocols.aave.userPositions(walletAddress),
      });
    }
  }, [refreshKey, walletAddress, queryClient]);

  useEffect(() => {
    if (!isLoading) {
      onCompleteRef.current?.();
    }
  }, [isLoading]);

  useEffect(() => {
    onValueRef.current?.(totalValue);
  }, [totalValue]);

  if (isLoading && positions.length === 0) {
    return null;
  }
  if (hasError) {
    return null;
  }
  if (positions.length === 0) {
    return null;
  }

  if (!protocol) {
    return null;
  }

  return (
    <ProtocolCard
      protocol={protocol}
      totalValue={totalValue}
      positions={protocolPositions}
      isLoading={isLoading && positions.length === 0}
      showManageButton={showManageButton}
    />
  );
}

