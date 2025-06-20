import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { EchelonPositions } from "./protocols/EchelonPositions";
import { JoulePositions } from "./protocols/JoulePositions";
import { HyperionPositions } from "./protocols/HyperionPositions";
import { TappPositions } from "./protocols/TappPositions";
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
      
      // Специальная обработка для Tapp Exchange
      let apiPath = protocol.name.toLowerCase();
      if (protocol.name.toLowerCase().includes('tapp')) {
        apiPath = 'tapp';
      }
      
      const response = await fetch(`/api/protocols/${apiPath}/userPositions?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      // Обновляем данные в компоненте протокола
      const data = await response.json();
      if (data.success) {
        // Вызываем обновление через событие
        window.dispatchEvent(new CustomEvent('refreshPositions', { 
          detail: { protocol: apiPath, data: data.data }
        }));
      }
    } catch (error) {
      console.error('Error refreshing positions:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const renderProtocolContent = () => {
    const protocolName = protocol.name.toLowerCase();
    
    // Специальная обработка для Tapp Exchange
    if (protocolName.includes('tapp')) {
      return <TappPositions />;
    }
    
    switch (protocolName) {
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
      <CardHeader className="pt-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {protocol.logoUrl && (
              <Image src={protocol.logoUrl} alt={protocol.name} width={32} height={32} className="object-contain" />
            )}
            <CardTitle className="text-xl font-bold">{protocol.name} positions</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
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