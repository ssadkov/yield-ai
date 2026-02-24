"use client";

import { useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { useWalletStore } from "@/lib/stores/walletStore";
import { formatCurrency } from "@/lib/utils/numberFormat";
import { ProtocolCard } from "@/shared/ProtocolCard";
import {
  useMoarPositions,
  useMoarRewards,
  useMoarPools,
} from "@/lib/query/hooks/protocols/moar";
import { queryKeys } from "@/lib/query/queryKeys";
import { mapMoarPositionsToProtocolPositions } from "./mapMoarToProtocolPositions";

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
  const { setRewards } = useWalletStore();

  const { data: positions = [], isLoading: positionsLoading, error: positionsError } = useMoarPositions(walletAddress);
  const { data: rewardsResponse, isLoading: rewardsLoading } = useMoarRewards(walletAddress);
  const { data: poolsResponse } = useMoarPools();

  const protocol = getProtocolByName("Moar Market");
  const onValueRef = useRef(onPositionsValueChange);
  const onCompleteRef = useRef(onPositionsCheckComplete);
  onValueRef.current = onPositionsValueChange;
  onCompleteRef.current = onPositionsCheckComplete;

  const rewardsData = rewardsResponse?.data ?? [];
  const rewardsTotalUsd = rewardsResponse?.totalUsd ?? 0;

  const positionsValue = useMemo(
    () =>
      positions.reduce((sum, p) => sum + parseFloat(p.value || "0"), 0),
    [positions]
  );
  const totalValue = positionsValue + rewardsTotalUsd;
  const aprByPoolId = useMemo(() => {
    if (!poolsResponse?.data) return {} as Record<number, number>;
    const map: Record<number, number> = {};
    poolsResponse.data.forEach((pool: { poolId?: number; totalAPY?: number }) => {
      if (pool.poolId !== undefined) {
        map[pool.poolId] = pool.totalAPY ?? 0;
      }
    });
    return map;
  }, [poolsResponse?.data]);

  const protocolPositions = useMemo(
    () => mapMoarPositionsToProtocolPositions(positions, aprByPoolId),
    [positions, aprByPoolId]
  );

  const totalRewardsUsd =
    rewardsTotalUsd > 0
      ? rewardsTotalUsd < 1
        ? "<$1"
        : formatCurrency(rewardsTotalUsd, 2)
      : undefined;

  const isLoading = positionsLoading || rewardsLoading;
  const hasError = Boolean(positionsError);

  useEffect(() => {
    if (refreshKey != null && walletAddress) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.protocols.moar.userPositions(walletAddress),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.protocols.moar.rewards(walletAddress),
      });
    }
  }, [refreshKey, walletAddress, queryClient]);

  useEffect(() => {
    if (!isLoading) {
      onCompleteRef.current?.();
    }
  }, [isLoading]);

  useEffect(() => {
    if (rewardsData.length > 0) {
      setRewards("moar", rewardsData);
    } else if (!rewardsLoading && walletAddress) {
      setRewards("moar", []);
    }
  }, [rewardsData, rewardsLoading, walletAddress, setRewards]);

  useEffect(() => {
    onValueRef.current?.(totalValue);
  }, [totalValue]);

  if (isLoading && positions.length === 0 && rewardsData.length === 0) {
    return null;
  }
  if (hasError) {
    return null;
  }
  if (positions.length === 0 && rewardsTotalUsd === 0) {
    return null;
  }

  if (!protocol) {
    return null;
  }

  return (
    <ProtocolCard
      protocol={protocol}
      totalValue={totalValue}
      totalRewardsUsd={totalRewardsUsd}
      positions={protocolPositions}
      isLoading={isLoading && positions.length === 0 && rewardsData.length === 0}
      showManageButton={showManageButton}
    />
  );
}
