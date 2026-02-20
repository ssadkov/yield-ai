import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { MoarPositions } from "./protocols/MoarPositions";
import { ThalaPositions } from "./protocols/ThalaPositions";
import { EchoPositions } from "./protocols/EchoPositions";
import { DecibelPositions } from "./protocols/DecibelPositions";
import { RefreshCw, Info, ExternalLink, Gift } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ProtocolSocialLinks } from "@/components/ui/protocol-social-links";
import { AirdropInfoTooltip } from "@/components/ui/airdrop-info-tooltip";

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
      let endpoint = 'userPositions';
      
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
        endpoint = 'positions'; // AAVE использует endpoint 'positions' вместо 'userPositions'
      } else if (protocol.name.toLowerCase().includes('moar')) {
        apiPath = 'moar';
        endpoint = 'userPositions';
      } else if (protocol.name.toLowerCase().includes('earnium')) {
        apiPath = 'earnium';
        endpoint = 'userPositions';
      } else if (protocol.name.toLowerCase().includes('echo')) {
        apiPath = 'echo';
        endpoint = 'userPositions';
      } else if (protocol.key === 'decibel' || protocol.name.toLowerCase().includes('decibel')) {
        apiPath = 'decibel';
        endpoint = 'userPositions';
      }
      
      const response = await fetch(`/api/protocols/${apiPath}/${endpoint}?address=${account.address}`);
      
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      // Обновляем данные в компоненте протокола
      const data = await response.json();
      if (data.success) {
        console.log('ManagePositions - Dispatching refreshPositions event:', { 
          protocol: apiPath, 
          data: data.data,
          eventDetail: { protocol: apiPath, data: data.data }
        });
        
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
      case 'moar market':
        return <MoarPositions />;
      case 'thala':
        return <ThalaPositions />;
      case 'echo protocol':
        return <EchoPositions />;
      case 'decibel':
        return <DecibelPositions />;
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
            <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              {protocol.name} positions
              {protocol.airdropInfo && (
                <AirdropInfoTooltip airdropInfo={protocol.airdropInfo} size="sm">
                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted hover:bg-muted/80 transition-colors cursor-help">
                    <Gift className="h-3 w-3 text-muted-foreground" />
                  </div>
                </AirdropInfoTooltip>
              )}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 text-xs hover:text-foreground"
                >
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 max-w-[90vw] p-4"
                side="left"
                sideOffset={10}
                align="start"
                avoidCollisions={true}
              >
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
                      className="h-7 text-xs text-foreground border-border hover:bg-accent hover:text-accent-foreground"
                      onClick={() => window.open(protocol.url, '_blank')}
                    >
                      Go to app
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                    <ProtocolSocialLinks
                      socialMedia={protocol.socialMedia}
                      size="sm"
                      disableTooltips={true}
                    />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
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
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {renderProtocolContent()}
      </CardContent>
    </Card>
  );
} 