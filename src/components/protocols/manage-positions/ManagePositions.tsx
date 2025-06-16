import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { EchelonPositions } from "./protocols/EchelonPositions";
import { JoulePositions } from "./protocols/JoulePositions";
import { HyperionPositions } from "./protocols/HyperionPositions";
import { RefreshCw } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";

interface ManagePositionsProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ManagePositions({ protocol, onClose }: ManagePositionsProps) {
  const { account } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!account?.address) return;
    
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/protocols/${protocol.name.toLowerCase()}/userPositions?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      // Обновляем данные в компоненте протокола
      const data = await response.json();
      if (data.success) {
        // Вызываем обновление через событие
        window.dispatchEvent(new CustomEvent('refreshPositions', { 
          detail: { protocol: protocol.name.toLowerCase(), data: data.data }
        }));
      }
    } catch (error) {
      console.error('Error refreshing positions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderProtocolContent = () => {
    switch (protocol.name.toLowerCase()) {
      case 'joule':
        return <JoulePositions />;
      case 'echelon':
        return <EchelonPositions />;
      case 'hyperion':
        return <HyperionPositions />;
      default:
        return (
          <div className="text-sm text-muted-foreground">
            Managing positions for {protocol.name}
          </div>
        );
    }
  };

  return (
    <Card className="w-full mb-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <div className="w-6 h-6 relative">
            <Image
              src={protocol.logoUrl}
              alt={protocol.name}
              width={24}
              height={24}
              className="object-contain"
            />
          </div>
          {protocol.name}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={isRefreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {renderProtocolContent()}
      </CardContent>
    </Card>
  );
} 