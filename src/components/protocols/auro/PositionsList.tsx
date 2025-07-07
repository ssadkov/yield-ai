import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuroPositionCard } from "./PositionCard";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

interface AuroPosition {
  id: string;
  token: string;
  amount: string;
  value: string;
  apy: number;
  protocol: string;
}

export function AuroPositionsList() {
  const { account } = useWallet();
  const [positions, setPositions] = useState<AuroPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.address) {
      setPositions([]);
      return;
    }

    const fetchPositions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(
          `/api/protocols/auro/userPositions?address=${account.address}`
        );
        
        if (!response.ok) {
          throw new Error("Failed to fetch Auro Finance positions");
        }
        
        const data = await response.json();
        setPositions(data);
      } catch (err) {
        console.error("Error fetching Auro Finance positions:", err);
        setError("Failed to load Auro Finance positions");
      } finally {
        setLoading(false);
      }
    };

    fetchPositions();
  }, [account?.address]);

  if (!account?.address) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auro Finance Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Connect your wallet to view Auro Finance positions
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auro Finance Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Loading Auro Finance positions...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auro Finance Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-center py-8">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Auro Finance Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No Auro Finance positions found
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auro Finance Positions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {positions.map((position) => (
            <AuroPositionCard key={position.id} position={position} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 