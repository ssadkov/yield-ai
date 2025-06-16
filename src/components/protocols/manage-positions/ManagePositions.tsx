import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import Image from "next/image";

interface ManagePositionsProps {
  protocol: Protocol;
  onClose: () => void;
}

export function ManagePositions({ protocol, onClose }: ManagePositionsProps) {
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
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          Managing positions for {protocol.name}
        </div>
      </CardContent>
    </Card>
  );
} 