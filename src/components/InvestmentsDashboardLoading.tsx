'use client';

import { Box } from "@radix-ui/themes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 w-full flex-wrap">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-5 w-20 ml-auto shrink-0 rounded-md" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-24 mb-1" />
                      <Skeleton className="h-3 w-16 mb-4" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-4">Fundamentals</h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 w-full flex-wrap">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-6 w-6 rounded-full" />
                          <Skeleton className="h-4 w-12" />
                        </div>
                        <Skeleton className="h-5 w-20 ml-auto shrink-0 rounded-md" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-24 mb-1" />
                      <Skeleton className="h-3 w-16 mb-4" />
                      <Skeleton className="h-10 w-full rounded-md" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}
        {activeTab === "pro" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-64" />
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
            <div className="border rounded-md">
              <div className="grid grid-cols-5 gap-4 p-4 border-b">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="grid grid-cols-5 gap-4 p-4 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-6 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              ))}
            </div>
          </div>
        )}
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
      </Box>
    </div>
  );
}

