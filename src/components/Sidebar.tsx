"use client";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Sidebar() {
  const { account, connected, connect, disconnect } = useWallet();
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      await connect('Petra');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Assets</h2>
      {!connected ? (
        <div>
          <Button onClick={handleConnect}>Connect Wallet</Button>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      ) : (
        <div>
          <p className="text-sm break-all mb-2">{account?.address?.toString()}</p>
          <Button variant="outline" onClick={disconnect}>Disconnect</Button>
        </div>
      )}
    </div>
  );
} 