'use client';

import { Box } from "@radix-ui/themes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@radix-ui/themes";
import { ProtocolIcon } from "@/shared/ProtocolIcon/ProtocolIcon";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface InvestmentsDashboardLoadingProps {
  className?: string;
  activeTab: "lite" | "pro";
  onTabChange: (value: "lite" | "pro") => void;
  protocolsLoading: Record<string, boolean>;
  protocolsError: Record<string, string | null>;
  protocolsData: Record<string, any[]>;
  protocolsLogos: Record<string, string>;
}

export function InvestmentsDashboardLoading({
  className,
  activeTab,
  onTabChange,
  protocolsLoading,
  protocolsError,
  protocolsData,
  protocolsLogos,
}: InvestmentsDashboardLoadingProps) {
  const loadingProtocols = Object.entries(protocolsLoading)
    .filter(([_, isLoading]) => isLoading)
    .map(([name]) => ({ name, logoUrl: protocolsLogos[name] || '/file.svg' }));

  return (
    <div className={className}>
      <div className="mb-4 pl-4">
        <h2 className="text-2xl font-bold">Ideas</h2>
      </div>
      <Box pt="2" pb="6">
        <SegmentedControl.Root
          value={activeTab}
          onValueChange={(value) => onTabChange(value as "lite" | "pro")}
          style={{ width: '100%' }}
          radius="full"
        >
          <SegmentedControl.Item value="lite" style={{ flex: 1 }}>Lite</SegmentedControl.Item>
          <SegmentedControl.Item value="pro" style={{ flex: 1 }}>Pro</SegmentedControl.Item>
        </SegmentedControl.Root>
      </Box>

      <Box pt="6">
        {activeTab === "lite" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Stables</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[100px]" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-[100px] mb-2" />
                      <Skeleton className="h-10 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Protocol loading status with spinning icons */}
            {loadingProtocols.length > 0 && (
              <div className="mt-6 flex flex-col items-center">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-1">
                  Checking pools
                  <span className="inline-flex gap-0.5 ml-1">
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                    <span className="loading-dot">.</span>
                  </span>
                </h4>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {loadingProtocols.map((protocol) => (
                    <TooltipProvider key={protocol.name} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <ProtocolIcon
                              logoUrl={protocol.logoUrl}
                              name={protocol.name}
                              size="md"
                              isLoading={true}
                              className="hover:border-primary/40 hover:shadow-lg"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={5}>
                          <p>{protocol.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Box>
    </div>
  );
}

