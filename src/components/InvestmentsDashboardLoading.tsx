'use client';

import { Box } from "@radix-ui/themes";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SegmentedControl } from "@radix-ui/themes";
import { Avatar } from "@/components/ui/avatar";

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

            {/* Protocol loading status */}
            <div className="mt-6">
              <h4 className="text-sm font-medium mb-3">Loading pools:</h4>
              <div className="space-y-2">
                {Object.entries(protocolsLoading).map(([protocolName, isLoading]) => (
                  <div key={protocolName} className="flex items-center gap-2 text-sm">
                    {isLoading ? (
                      <>
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse">
                          <Avatar className="w-3 h-3">
                            <img
                              src={protocolsLogos[protocolName]}
                              alt={protocolName}
                              className="object-contain bg-white"
                            />
                          </Avatar>
                        </div>
                        <span>Loading {protocolName}...</span>
                      </>
                    ) : protocolsError[protocolName] ? (
                      <>
                        <div className="w-3 h-3 bg-red-500 rounded-full">
                          <Avatar className="w-3 h-3">
                            <img
                              src={protocolsLogos[protocolName]}
                              alt={protocolName}
                              className="object-contain bg-white"
                            />
                          </Avatar>
                        </div>
                        <span className="text-red-500">{protocolName}: {protocolsError[protocolName]}</span>
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full">
                          <Avatar className="w-3 h-3">
                            <img
                              src={protocolsLogos[protocolName]}
                              alt={protocolName}
                              className="object-contain bg-white"
                            />
                          </Avatar>
                        </div>
                        <span className="text-green-600">{protocolName}: {protocolsData[protocolName]?.length || 0} pools loaded</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Box>
    </div>
  );
}

