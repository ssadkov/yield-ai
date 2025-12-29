"use client";

import * as React from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import styles from "./ProtocolIcon.module.css";

export interface ProtocolIconProps
  extends Omit<ComponentPropsWithoutRef<"div">, "title"> {
  logoUrl: string;
  name: string;
  size?: "sm" | "md" | "lg" | number;
  isLoading?: boolean;
}

const sizeMap = {
  sm: 24,
  md: 40,
  lg: 56,
};

export const ProtocolIcon = React.forwardRef<HTMLDivElement, ProtocolIconProps>(
  (
    { logoUrl, name, size = "md", isLoading = false, className, ...props },
    ref
  ) => {
    const sizeValue = typeof size === "number" ? size : sizeMap[size];

    if (isLoading) {
      return (
        <div
          ref={ref}
          className={cn(
            "relative rounded-full bg-background border-2 border-primary/20 shadow-md overflow-hidden transition-all duration-300",
            styles.iconLoading,
            className
          )}
          style={{ width: sizeValue, height: sizeValue }}
          title={name}
          {...props}
        >
          <div className={cn(styles.iconInner, "animate-spin-slow")}>
            <Image
              src={logoUrl}
              alt={name}
              width={Math.round(sizeValue * 0.7)}
              height={Math.round(sizeValue * 0.7)}
              className="object-contain"
              unoptimized
            />
          </div>
        </div>
      );
    }

    return (
      <Avatar
        ref={ref}
        className={cn("border-2 border-border", className)}
        style={{ width: sizeValue, height: sizeValue }}
        title={name}
        {...props}
      >
        <AvatarImage src={logoUrl} alt={name} className="object-contain" />
        <AvatarFallback>
          <Loader2 className="h-4 w-4 animate-spin" />
        </AvatarFallback>
      </Avatar>
    );
  }
);

ProtocolIcon.displayName = "ProtocolIcon";

