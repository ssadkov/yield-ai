import { useState } from 'react';

export function WalletConnectButton() {
  const handleConnect = async () => {
    try {
      // TODO: Implement wallet connection
      console.log('Connecting wallet...');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  return (
    <button
      onClick={handleConnect}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Connect Wallet
    </button>
  );
} 