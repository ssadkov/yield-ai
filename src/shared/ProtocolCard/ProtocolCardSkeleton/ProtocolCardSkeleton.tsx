"use client";

import Image from "next/image";
import type { Protocol } from "@/lib/protocols/getProtocolsList";
import styles from "./ProtocolCardSkeleton.module.css";

export interface ProtocolCardSkeletonProps {
  protocol: Protocol;
}

export function ProtocolCardSkeleton({ protocol }: ProtocolCardSkeletonProps) {
  const logoUrl = protocol.logoUrl;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          {logoUrl ? <Image src={logoUrl} alt="" width={20} height={20} className={styles.logo} unoptimized /> : <div className={styles.pulse} style={{ width: 20, height: 20 }} />}
          <span style={{ fontSize: "1.125rem", fontWeight: 600 }}>{protocol.name}</span>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.pulse} style={{ width: 64, height: 18 }} />
          <div className={styles.pulse} style={{ width: 20, height: 20 }} />
        </div>
      </div>
      <div className={styles.content}>
        {[1, 2].map((i) => (
          <div key={i} className={styles.row}>
            <div className={styles.pulse} style={{ width: 24, height: 24, borderRadius: "50%" }} />
            <div className={styles.rowLeft}>
              <div className={styles.pulse} style={{ width: 96, height: 14 }} />
              <div className={styles.pulse} style={{ width: 64, height: 12 }} />
            </div>
            <div className={styles.pulse} style={{ width: 56, height: 16 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
