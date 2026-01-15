"use client";

import React from 'react';
import { useMediaQuery } from 'react-responsive';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Gift } from "lucide-react";
import { AirdropInfoMobile } from "./airdrop-info-mobile";

interface AirdropInfoTooltipProps {
  airdropInfo: {
    title: string;
    description: string;
    links: Array<{
      text: string;
      url: string;
      type: 'twitter' | 'app' | 'docs' | 'website';
    }>;
    requirements: string[];
    additionalInfo?: string;
  };
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function AirdropInfoTooltip({ airdropInfo, children, size = 'sm' }: AirdropInfoTooltipProps) {
  const isMobile = useMediaQuery({ maxWidth: 767 });

  // Use mobile component for mobile devices
  if (isMobile) {
    return (
      <AirdropInfoMobile airdropInfo={airdropInfo} size={size}>
        {children}
      </AirdropInfoMobile>
    );
  }
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent 
          className="w-80 max-w-[90vw] p-4" 
          side="top" 
          sideOffset={5}
          align="center"
          avoidCollisions={true}
        >
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">{airdropInfo.title}</h4>
            <p className="text-sm text-muted-foreground">{airdropInfo.description}</p>
            
            {airdropInfo.links.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Links:</p>
                {airdropInfo.links.map((link, index) => (
                  <a 
                    key={index}
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:text-blue-800 text-xs underline"
                  >
                    {link.text}
                  </a>
                ))}
              </div>
            )}
            
            {airdropInfo.requirements.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-foreground">Requirements:</p>
                <ul className="text-xs text-muted-foreground space-y-0.5">
                  {airdropInfo.requirements.map((req, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-1">•</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {airdropInfo.additionalInfo && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground italic">{airdropInfo.additionalInfo}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
