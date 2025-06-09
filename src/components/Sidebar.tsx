"use client";
import { WalletSelector } from "./WalletSelector";

export default function Sidebar() {
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Assets</h2>
      <WalletSelector />
    </div>
  );
} 