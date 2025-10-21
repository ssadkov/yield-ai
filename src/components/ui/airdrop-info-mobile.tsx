"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AirdropInfoMobileProps {
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
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function AirdropInfoMobile({ airdropInfo, children, size = 'sm' }: AirdropInfoMobileProps) {
  const [open, setOpen] = useState(false);

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4", 
    lg: "h-5 w-5"
  };

  const buttonSizeClasses = {
    sm: "w-5 h-5",
    md: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "rounded-full bg-muted hover:bg-muted/80 transition-colors",
              buttonSizeClasses[size]
            )}
          >
            <Gift className={cn("text-muted-foreground", sizeClasses[size])} />
            <span className="sr-only">Airdrop Information</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{airdropInfo.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {airdropInfo.description}
          </p>
          
          {airdropInfo.links.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Links:</h4>
              <div className="space-y-2">
                {airdropInfo.links.map((link, index) => (
                  <a 
                    key={index}
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors"
                    onClick={() => setOpen(false)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{link.text}</span>
                      <span className="text-xs text-muted-foreground capitalize">{link.type}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          
          {airdropInfo.requirements.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-foreground">Requirements:</h4>
              <ul className="space-y-1">
                {airdropInfo.requirements.map((req, index) => (
                  <li key={index} className="flex items-start text-sm text-muted-foreground">
                    <span className="mr-2 mt-0.5 flex-shrink-0">•</span>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {airdropInfo.additionalInfo && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground italic">{airdropInfo.additionalInfo}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
