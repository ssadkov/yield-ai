'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { PositionCard } from "@/components/protocols/hyperion/PositionCard";

export function HyperionPositions() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPositions = async () => {
    if (!account?.address) {
      setPositions([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/protocols/hyperion/userPositions?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success && Array.isArray(data.data)) {
        // Сортируем позиции по сумме ликвидности
        const sortedPositions = [...data.data].sort((a, b) => {
          const valueA = parseFloat(a.value || "0");
          const valueB = parseFloat(b.value || "0");
          return valueB - valueA;
        });
        setPositions(sortedPositions);
      } else {
        setPositions([]);
      }
    } catch (err) {
      console.error('Error loading Hyperion positions:', err);
      setError('Failed to load positions');
      setPositions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();

    // Добавляем обработчик события обновления
    const handleRefresh = (event: CustomEvent) => {
      if (event.detail.protocol === 'hyperion') {
        // Сортируем позиции при обновлении
        const sortedPositions = [...event.detail.data].sort((a, b) => {
          const valueA = parseFloat(a.value || "0");
          const valueB = parseFloat(b.value || "0");
          return valueB - valueA;
        });
        setPositions(sortedPositions);
      }
    };

    window.addEventListener('refreshPositions', handleRefresh as EventListener);
    return () => {
      window.removeEventListener('refreshPositions', handleRefresh as EventListener);
    };
  }, [account?.address]);

  // Считаем общую сумму (позиции + награды)
  const totalValue = positions.reduce((sum, position) => {
    const positionValue = parseFloat(position.value || "0");
    const farmRewards = position.farm?.unclaimed?.reduce((rewardSum: number, reward: { amountUSD: string }) => {
      return rewardSum + parseFloat(reward.amountUSD || "0");
    }, 0) || 0;
    const feeRewards = position.fees?.unclaimed?.reduce((feeSum: number, fee: { amountUSD: string }) => {
      return feeSum + parseFloat(fee.amountUSD || "0");
    }, 0) || 0;
    return sum + positionValue + farmRewards + feeRewards;
  }, 0);

  if (loading) {
    return <div>Loading positions...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <ScrollArea className="h-[400px]">
        {positions.map((position, index) => (
          <PositionCard 
            key={`${position.assetName}-${index}`} 
            position={position} 
            isManageView={true}
          />
        ))}
      </ScrollArea>
      <div className="text-sm text-muted-foreground">
        Total assets in Hyperion: ${totalValue.toFixed(2)}
      </div>
    </div>
  );
} 