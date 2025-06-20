import { Badge } from "./badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

interface AlphaBadgeProps {
  className?: string;
  variant?: "default" | "secondary" | "outline";
}

export function AlphaBadge({ className, variant = "secondary" }: AlphaBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={variant} 
            className={cn(
              "bg-gradient-to-r from-orange-100 to-red-100 text-orange-800 border-orange-200 font-medium",
              "hover:from-orange-200 hover:to-red-200 transition-all duration-200",
              "text-xs px-2 py-0.5",
              className
            )}
          >
            <span className="animate-pulse mr-1">●</span>
            Beta version
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex items-center gap-2">
            <span>🧪</span>
            <span>Early Access - Features may change</span>
            <span>🚀</span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
} 