"use client";

import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ProtocolSocialLinksProps {
  socialMedia?: {
    twitter?: string;
    discord?: string;
    telegram?: string;
    github?: string;
  };
  size?: "sm" | "md" | "lg";
  variant?: "default" | "outline" | "ghost";
  disableTooltips?: boolean;
}

export function ProtocolSocialLinks({ 
  socialMedia, 
  size = "sm", 
  variant = "ghost",
  disableTooltips = false
}: ProtocolSocialLinksProps) {
  if (!socialMedia) return null;

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return '𝕏';
      case 'discord':
        return '💬';
      case 'telegram':
        return '📱';
      case 'github':
        return '🔗';
      default:
        return '🔗';
    }
  };

  const getSocialLabel = (platform: string) => {
    switch (platform) {
      case 'twitter':
        return 'Follow on X (Twitter)';
      case 'discord':
        return 'Join Discord';
      case 'telegram':
        return 'Join Telegram';
      case 'github':
        return 'View on GitHub';
      default:
        return 'Visit';
    }
  };

  const sizeClasses = {
    sm: "h-6 w-6 text-xs",
    md: "h-8 w-8 text-sm",
    lg: "h-10 w-10 text-base"
  };

  const socialEntries = Object.entries(socialMedia).filter(([_, url]) => url);

  if (socialEntries.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      {socialEntries.map(([platform, url]) => {
        const button = (
          <Button
            variant={variant}
            size="icon"
            className={sizeClasses[size]}
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            title={disableTooltips ? (platform === 'twitter' ? 'Follow on X' : getSocialLabel(platform)) : undefined}
          >
            <span className="flex items-center justify-center">
              {getSocialIcon(platform)}
            </span>
            <span className="sr-only">{platform === 'twitter' ? 'Follow on X' : getSocialLabel(platform)}</span>
          </Button>
        );

        if (disableTooltips) {
          return <div key={platform}>{button}</div>;
        }

        return (
          <TooltipProvider key={platform} delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                {button}
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={5}>
                <p>{getSocialLabel(platform)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}
