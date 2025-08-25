import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";
import { EchelonPositions } from "./protocols/EchelonPositions";
import { JoulePositions } from "./protocols/JoulePositions";
import { HyperionPositions } from "./protocols/HyperionPositions";
import { TappPositions } from "./protocols/TappPositions";
import { MesoPositions } from "./protocols/MesoPositions";
import { AuroPositions } from "./protocols/AuroPositions";
import { AmnisPositions } from "./protocols/AmnisPositions";
import { EarniumPositionsManaging } from "./protocols/EarniumPositions";
import { AavePositions } from "./protocols/AavePositions";
import { RefreshCw, Info, ExternalLink } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

interface ManagePositionsProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ManagePositions({ protocol, onClose }: ManagePositionsProps) {
  const { account } = useWallet();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  const handleRefresh = async () => {
    if (!account?.address) return;
    
    try {
      setIsRefreshing(true);
      
      // Специальная обработка для разных протоколов
      let apiPath = protocol.name.toLowerCase();
      if (protocol.name.toLowerCase().includes('tapp')) {
        apiPath = 'tapp';
      } else if (protocol.name.toLowerCase().includes('auro')) {
        apiPath = 'auro';
      } else if (protocol.name.toLowerCase().includes('meso')) {
        apiPath = 'meso';
      } else if (protocol.name.toLowerCase().includes('amnis')) {
        apiPath = 'amnis';
      } else if (protocol.name.toLowerCase().includes('aave')) {
        apiPath = 'aave';
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
        toast({
          title: "Success",
          description: `${protocol.name} positions refreshed successfully`,
        });
      } else {
        throw new Error('Failed to refresh positions');
      }
    } catch (error) {
      console.error('Error refreshing positions:', error);
      toast({
        title: "Error",
        description: `Failed to refresh ${protocol.name} positions`,
        variant: "destructive"
      });
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
      case 'meso finance':
        return <MesoPositions />;
      case 'auro finance':
        return <AuroPositions />;
      case 'amnis finance':
        return <AmnisPositions />;
      case 'earnium':
        return <EarniumPositionsManaging />;
      case 'aave':
        return <AavePositions />;
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {protocol.logoUrl && (
              <Image src={protocol.logoUrl} alt={protocol.name} width={32} height={32} className="object-contain" />
            )}
            <CardTitle className="text-lg sm:text-xl font-bold">{protocol.name} positions</CardTitle>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 text-xs hover:text-foreground"
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      <span className="sr-only">Refresh positions</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh positions</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-gray-400 text-xs hover:text-foreground"
                    >
                      <Info className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="w-80 p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">{protocol.name}</h4>
                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">{protocol.category}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{protocol.description}</p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-gray-400 text-xs bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                          onClick={() => window.open(protocol.url, '_blank')}
                        >
                          Visit Protocol
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="self-end sm:self-auto">
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