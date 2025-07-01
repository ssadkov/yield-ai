"use client";

import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { useCollapsible } from "@/contexts/CollapsibleContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CollapsibleControls() {
  const { expandAll, collapseAll } = useCollapsible();

  return (
    <div className="flex gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={expandAll}
            className="h-6 w-6 p-0 hover:bg-accent transition-colors"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Expand All</p>
        </TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={collapseAll}
            className="h-6 w-6 p-0 hover:bg-accent transition-colors"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Collapse All</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
} 