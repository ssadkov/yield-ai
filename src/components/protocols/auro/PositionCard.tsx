import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, TrendingUp } from "lucide-react";

interface AuroPositionCardProps {
  position: {
    id: string;
    token: string;
    amount: string;
    value: string;
    apy: number;
    protocol: string;
  };
}

export function AuroPositionCard({ position }: AuroPositionCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{position.token}</span>
            <Badge variant="secondary" className="text-xs">
              {position.protocol}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-green-600">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm font-medium">
              {position.apy.toFixed(2)}% APR
            </span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Amount:</span>
          <span className="font-medium">{position.amount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Value:</span>
          <span className="font-medium">${position.value}</span>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            Manage
          </Button>
          <Button variant="outline" size="sm" className="flex-1">
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 