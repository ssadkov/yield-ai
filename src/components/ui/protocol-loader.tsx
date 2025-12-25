"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";

interface ProtocolLoaderProps {
  protocols: Array<{
    name: string;
    logoUrl: string;
    isLoading: boolean;
    hasError?: boolean;
    isComplete?: boolean;
  }>;
  className?: string;
}

export function ProtocolLoader({ protocols, className }: ProtocolLoaderProps) {
  const loadingProtocols = protocols.filter(p => p.isLoading);

  if (loadingProtocols.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col items-center justify-center py-8", className)}>
      {/* Заголовок */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-muted-foreground">Checking pools</h4>
      </div>

      {/* Вращающиеся иконки загружающихся протоколов */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {loadingProtocols.map((protocol) => (
          <div
            key={protocol.name}
            className="relative flex items-center justify-center group"
            title={protocol.name}
          >
            <div className="relative w-14 h-14 rounded-full bg-background border-2 border-primary/20 shadow-md overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-lg">
              {/* Вращающаяся иконка */}
              <div className="absolute inset-0 flex items-center justify-center animate-spin-slow">
                <Image
                  src={protocol.logoUrl}
                  alt={protocol.name}
                  width={40}
                  height={40}
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

