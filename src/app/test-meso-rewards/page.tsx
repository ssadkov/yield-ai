"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

export default function TestMesoRewardsPage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [claiming, setClaiming] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const { connected, signAndSubmitTransaction } = useWallet();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      setData(null);
      const res = await fetch(`/api/protocols/meso/rewards?address=${address}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const claimAll = async () => {
    try {
      setClaiming(true);
      setError(null);
      setTxHash(null);
      // For now we will just display the payload needed to claim all rewards across supported tokens.
      // The real on-chain submit should be wired via the wallet flow on the manage page.
      const functionAddress = '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7';
      const tokens = [
        "0x1::aptos_coin::AptosCoin",
        "0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b",
        "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::stapt_token::StakedApt",
        "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
        "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a::amapt_token::AmnisApt",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WBTC",
        "0xfaf4e633ae9eb31366c9ca24214231760926576c7b625313b3688b5e900731f6::staking::StakedThalaAPT",
        "0xb36527754eb54d7ff55daf13bcb54b42b88ec484bd6f0e3b2e0d1db169de6451",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC",
        "0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH",
        "0x68844a0d7f2587e726ad0579f3d640865bb4162c08a4589eeda3f9689ec52a3d",
        "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea::coin::T",
        "0x2ebb2ccac5e027a87fa0e2e5f656a3a4238d6a48d93ec9b610d570fc0aa0df12",
        "0xada35ada7e43e2ee1c39633ffccec38b76ce702b4efc2e60b50f63fbe4f710d8::apetos_token::ApetosCoin",
        "0x159df6b7689437016108a019fd5bef736bac692b6d4a1f10c941f6fbb9a74ca6::oft::CakeOFT",
        "0x63be1898a424616367e19bbd881f456a78470e123e2770b5b5dcdceb61279c54::movegpt_token::MovegptCoin",
        "0xaef6a8c3182e076db72d64324617114cacf9a52f28325edc10b483f7f05da0e7"
      ];
      // Use meso::claim_all_apt_rewards(&signer, vector<string>)
      const dataPayload = {
        function: `${functionAddress}::meso::claim_all_apt_rewards` as `${string}::${string}::${string}`,
        typeArguments: [] as string[],
        functionArguments: [tokens] as any[]
      } as const;

      if (!connected || !signAndSubmitTransaction) {
        throw new Error('Wallet not connected');
      }

      let txResponse: any;
      try {
        txResponse = await signAndSubmitTransaction({ data: dataPayload });
      } catch (legacyFormatError) {
        // try legacy formats
        try {
          // direct payload
          // @ts-ignore
          txResponse = await signAndSubmitTransaction(dataPayload as any);
        } catch (dataWrapperError) {
          // final fallback
          // @ts-ignore
          txResponse = await signAndSubmitTransaction({ data: dataPayload } as any);
        }
      }

      const hash = txResponse?.hash || txResponse?.transactionHash || null;
      setTxHash(hash);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Meso Rewards Tester</h1>
      <div className="flex gap-2 items-center">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="0x... wallet address"
          className="border rounded px-3 py-2 flex-1"
        />
        <button
          onClick={load}
          disabled={!address || loading}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load rewards"}
        </button>
      </div>

      {error && <div className="text-red-600">{error}</div>}

      {data && (
        <div className="space-y-3">
          <div className="text-lg font-medium">Total Rewards USD: ${Number(data.totalUsd || 0).toFixed(2)}</div>
          <div>
            <button
              onClick={claimAll}
              className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
              disabled={claiming}
            >
              {claiming ? 'Preparing claim...' : 'Claim All (show payload)'}
            </button>
          </div>
          {txHash && (
            <div className="text-sm">Submitted tx: <a className="text-blue-600 underline" target="_blank" rel="noreferrer" href={`https://explorer.aptoslabs.com/txn/${txHash}?network=mainnet`}>{txHash}</a></div>
          )}
          <div className="border rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="p-2">Side</th>
                  <th className="p-2">Pool</th>
                  <th className="p-2">Reward Pool</th>
                  <th className="p-2">Token</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Price</th>
                  <th className="p-2">USD</th>
                </tr>
              </thead>
              <tbody>
                {data.rewards?.map((r: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{r.side}</td>
                    <td className="p-2 font-mono text-xs">{r.poolInner}</td>
                    <td className="p-2 font-mono text-xs">{r.rewardPoolInner}</td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {r.logoUrl && <img src={r.logoUrl} alt={r.symbol} className="w-5 h-5" />}
                        <span>{r.symbol}</span>
                      </div>
                    </td>
                    <td className="p-2">{Number(r.amount).toFixed(6)}</td>
                    <td className="p-2">{r.price ? `$${Number(r.price).toFixed(4)}` : '-'}</td>
                    <td className="p-2">${Number(r.usdValue).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


