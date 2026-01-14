import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CardTitle } from "@/components/ui/card";
import { getProtocolByName } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";

interface ProtocolCardSkeletonProps {
  protocolName: string;
}

export function ProtocolCardSkeleton({ protocolName }: ProtocolCardSkeletonProps) {
  const protocol = getProtocolByName(protocolName);
  const logoUrl = protocol?.logoUrl;

  return (
    <Card className="w-full">
      <CardHeader className="py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {logoUrl ? (
              <div className="w-5 h-5 relative opacity-70">
                <Image
                  src={logoUrl}
                  alt={protocolName}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            ) : (
              <Skeleton className="h-5 w-5 rounded" />
            )}
            <CardTitle className="text-lg">{protocolName}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-5" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-3 pt-0">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

