"use client";

import * as React from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Badge as RadixBadge } from "@radix-ui/themes";

import { cn } from "@/lib/utils";
import styles from "./Badge.module.css";

export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "danger"
  | "info"
  | "warning";

export interface BadgeProps
  extends Omit<ComponentPropsWithoutRef<typeof RadixBadge>, "variant"> {
  /**
   * Вариант оформления бейджа.
   * Мапится на css‑классы в `Badge.module.css`, а не на встроенные темы Radix.
   */
  variant?: BadgeVariant;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const variantClassName =
      styles[`variant-${variant}` as keyof typeof styles] ??
      styles["variant-default"];

    return (
      <RadixBadge
        ref={ref}
        className={cn(styles.badge, variantClassName, className)}
        {...props}
      >
        {children}
      </RadixBadge>
    );
  }
);

Badge.displayName = "Badge";
