import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import { ManagePositions } from "../protocols/manage-positions/ManagePositions";

export function Sidebar() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

  useEffect(() => {
    // TODO: Загрузить реальные данные
    setTokens([
      { symbol: 'APT', amount: 100, value: 1000 },
      { symbol: 'USDC', amount: 1000, value: 1000 },
    ]);
    setTotalValue(2000);
  }, []);

  const handleManageClick = (protocol: Protocol) => {
    console.log('Selected protocol:', protocol);
    setSelectedProtocol(protocol);
  };

  return (
    <div className="w-80 space-y-4">
      {selectedProtocol && (
        <ManagePositions 
          protocol={selectedProtocol} 
          onClose={() => setSelectedProtocol(null)} 
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          <div className="space-y-2 mt-4">
            {tokens.map((token) => (
              <div key={token.symbol} className="flex justify-between items-center">
                <span>{token.symbol}</span>
                <span>${token.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protocols</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {['Hyperion', 'Joule', 'Echelon', 'Aries'].map((name) => {
              const protocol = getProtocolByName(name);
              if (!protocol) return null;

              return (
                <div key={name} className="flex justify-between items-center">
                  <span>{name}</span>
                  {protocol.managedType === "native" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleManageClick(protocol)}
                    >
                      Manage Positions
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 