import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ExternalLink, TrendingUp } from "lucide-react";

interface AuroPosition {
  id: string;
  token: string;
  amount: string;
  value: string;
  apy: number;
  protocol: string;
}

export function AuroPositions() {
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
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img 
              src="https://app.auro.finance/logo.png" 
              alt="Auro Finance" 
              className="w-6 h-6 rounded"
            />
            Auro Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            Loading positions...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img 
              src="https://app.auro.finance/logo.png" 
              alt="Auro Finance" 
              className="w-6 h-6 rounded"
            />
            Auro Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-center py-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img 
              src="https://app.auro.finance/logo.png" 
              alt="Auro Finance" 
              className="w-6 h-6 rounded"
            />
            Auro Finance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">
              No Auro Finance positions found
            </p>
            <Button asChild>
              <a 
                href="https://app.auro.finance?ref=Y7RSIC14LS4F" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Auro Finance
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <img 
            src="https://app.auro.finance/logo.png" 
            alt="Auro Finance" 
            className="w-6 h-6 rounded"
          />
          Auro Finance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.map((position) => (
            <div 
              key={position.id} 
              className="flex items-center justify-between p-4 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{position.token}</span>
                    <Badge variant="secondary" className="text-xs">
                      {position.protocol}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {position.amount} (${position.value})
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {position.apy.toFixed(2)}% APY
                  </span>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a 
                    href="https://app.auro.finance?ref=Y7RSIC14LS4F" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Manage
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
} 