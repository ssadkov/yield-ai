"use client";

import Image from "next/image";
import { formatCurrency } from "@/lib/utils/numberFormat";
import { Badge } from "@/shared/Badge/Badge";
import type { ProtocolPosition } from "../types";
import { PositionBadge } from "../types";
import styles from "./ProtocolCardPosition.module.css";

export interface ProtocolCardPositionProps {
  position: ProtocolPosition;
}

function getBadgeVariant(badge: PositionBadge): "success" | "danger" {
  return badge === PositionBadge.Active || badge === PositionBadge.Supply ? "success" : "danger";
}

export function ProtocolCardPosition({ position }: ProtocolCardPositionProps) {
  const isPool = Boolean(position.logoUrl && position.logoUrl2);
  const logoUrl = position.logoUrl;
  const logoUrl2 = position.logoUrl2;
  const isCollateral = position.isCollateral;

  if (isPool && logoUrl && logoUrl2) {
    return (
      <div className={styles.root}>
        <div className={styles.row}>
          <div className={styles.left}>
            <div className={styles.logosCol}>
              <div className={styles.logosRow}>
                <Image src={logoUrl} alt="" width={24} height={24} className={styles.logo} unoptimized />
                <Image src={logoUrl2} alt="" width={24} height={24} className={`${styles.logo} ${styles.logoStack}`} unoptimized />
              </div>
              {position.badge != null && (
                <Badge variant={getBadgeVariant(position.badge)} className={styles.statusBadge}>
                  {position.badge}
                </Badge>
              )}
            </div>
            <span className={styles.label}>{position.label}</span>
          </div>
          <span className={styles.value}>{formatCurrency(position.value, 2)}</span>
        </div>
      </div>
    );
  }

  const isBorrow = position.badge === PositionBadge.Borrow;

  return (
    <div className={styles.root}>
      <div className={styles.singleRow}>

        <div className={styles.singleLeft}>
          {logoUrl && <Image src={logoUrl} alt="" width={24} height={24} className={styles.logo} unoptimized />}
          <div className={styles.singleLabelBlock}>
            <div className={styles.labelAndBadge}>
              <span className={styles.label}>{position.label}</span>
              {position.badge && (
                <Badge
                  variant={getBadgeVariant(position.badge)}
                  className={styles.typeBadge}
                >
                  {position.badge}
                </Badge>
              )}
              {isCollateral && (
                <Badge variant="info" className={styles.typeBadge}>
                  Collateral
                </Badge>
              )}
            </div>
            {position.price != null && (
              <span className={styles.price}>{formatCurrency(position.price, 2)}</span>
            )}
          </div>
        </div>

        <div className={styles.rightCol}>
          <span className={isBorrow ? styles.valueBorrow : styles.value}>
            {formatCurrency(position.value, 2)}
          </span>
          {position.subLabel != null && position.subLabel !== "" && (
            <span className={styles.sublabel}>{position.subLabel}</span>
          )}
        </div>

      </div>
    </div>
  );
}
