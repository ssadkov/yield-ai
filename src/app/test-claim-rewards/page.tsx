'use client';

import { useEffect } from 'react';
import { useWalletStore } from '@/lib/stores/walletStore';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { ClaimRewardsBlock } from '@/components/ui/claim-rewards-block';
import { ClaimAllRewardsModal } from '@/components/ui/claim-all-rewards-modal';
import { useState } from 'react';

export default function TestClaimRewards() {
  const { getClaimableRewardsSummary, fetchRewards, rewardsLoading, rewards } = useWalletStore();
  const { account } = useWallet();
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  useEffect(() => {
    if (account?.address) {
      fetchRewards(account.address.toString());
    }
  }, [account?.address, fetchRewards]);

  const [summary, setSummary] = useState<any>(null);
  
  // Load summary when rewards change
  useEffect(() => {
    const loadSummary = async () => {
      const summaryData = await getClaimableRewardsSummary();
      setSummary(summaryData);
    };
    loadSummary();
  }, [getClaimableRewardsSummary, rewardsLoading]);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Claim Rewards</h1>
      
      <div className="space-y-6">
        {/* Wallet Status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Wallet Status</h2>
          <p>Address: {account?.address?.toString() || 'Not connected'}</p>
          <p>Loading: {rewardsLoading ? 'Yes' : 'No'}</p>
        </div>

        {/* Raw Rewards Data */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Raw Rewards Data</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(rewards, null, 2)}
          </pre>
        </div>

        {/* Summary */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Claimable Rewards Summary</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(summary, null, 2)}
          </pre>
        </div>

        {/* Claim Rewards Block */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Claim Rewards Block</h2>
          <ClaimRewardsBlock 
            summary={summary}
            onClaim={() => setClaimModalOpen(true)}
            loading={rewardsLoading}
          />
        </div>

        {/* Manual Refresh Button */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Manual Actions</h2>
          <button 
            onClick={() => account?.address && fetchRewards(account.address.toString(), undefined, true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Refresh Rewards
          </button>
        </div>
      </div>

      {/* Claim All Rewards Modal */}
      {summary && (
        <ClaimAllRewardsModal
          isOpen={claimModalOpen}
          onClose={() => setClaimModalOpen(false)}
          summary={summary}
        />
      )}
    </div>
  );
} 