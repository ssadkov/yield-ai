'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwapModal } from '@/components/ui/swap-modal';
import { YieldCalculatorModal } from '@/components/ui/yield-calculator-modal';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import { useWalletData } from '@/contexts/WalletContext';
import { useWalletStore } from '@/lib/stores/walletStore';
import { useMemo } from 'react';

export default function ChatPanel() {
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isYieldCalcOpen, setIsYieldCalcOpen] = useState(false);
  const { account } = useWallet();
  const { tokens } = useWalletData();
  const totalAssetsStore = useWalletStore((s) => s.totalAssets);
  const router = useRouter();

  const walletTotal = useMemo(() => {
    return (tokens || []).reduce((sum, t: any) => {
      let v = 0;
      if (t?.value != null) {
        const parsed = parseFloat(t.value as string);
        v = isNaN(parsed) ? 0 : parsed;
      } else if (t?.price != null) {
        const price = parseFloat(t.price as string);
        const decimals = typeof t.decimals === 'number' ? t.decimals : 8;
        const raw = parseFloat(t.amount as string);
        const amount = isNaN(raw) ? 0 : raw / Math.pow(10, decimals);
        v = (isNaN(price) ? 0 : price) * amount;
      }
      return sum + (isFinite(v) ? v : 0);
    }, 0);
  }, [tokens]);

  const totalAssets = useMemo(() => {
    if (totalAssetsStore && totalAssetsStore > 0) return totalAssetsStore;
    return walletTotal;
  }, [totalAssetsStore, walletTotal]);

  const handlePortfolioTracker = () => {
    if (account?.address) {
      // If wallet is connected, go directly to portfolio page with the address
      router.push(`/portfolio/${account.address}`);
    } else {
      // If no wallet connected, go to portfolio input page
      router.push('/portfolio');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Tools</h1>
        <ThemeToggle />
      </div>
      <div className="mt-4 flex flex-col gap-2 w-full">
        <Button 
          variant="outline" 
          onClick={() => setIsSwapModalOpen(true)}
          className="flex items-center gap-2 w-full justify-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Swap
        </Button>
        <Button 
          variant="outline" 
          onClick={() => setIsYieldCalcOpen(true)}
          className="flex items-center gap-2 w-full justify-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          Yield Calculator
        </Button>
        <Button 
          variant="outline" 
          onClick={handlePortfolioTracker}
          className="flex items-center gap-2 w-full justify-start"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Portfolio Tracker
        </Button>
      </div>

      {/* Compact Footer - Mobile only */}
      <div className="mt-8 pt-4 border-t border-border md:hidden">
        <div className="flex flex-col items-center gap-3">
          {/* Social Links */}
          <div className="flex items-center gap-4">
            <Link
              href="https://x.com/yieldai_app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Yield AI
            </Link>
            <Link
              href="https://x.com/ssadkov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Founder
            </Link>
            <Link
              href="https://home.yieldai.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              Home
            </Link>
          </div>
          
          {/* Share Feedback Button */}
          <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">
              Share Feedback
            </Button>
          </Link>
        </div>
      </div>

      {/* Desktop Footer - X links + Share Feedback */}
      <div className="mt-8 pt-4 border-t border-border hidden md:block">
        <div className="flex flex-col items-center gap-3">
          {/* Social Links */}
          <div className="flex items-center gap-4">
            <Link
              href="https://x.com/yieldai_app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Yield AI
            </Link>
            <Link
              href="https://x.com/ssadkov"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              Founder
            </Link>
          </div>
          
          {/* Share Feedback Button */}
          <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="text-xs">
              Share Feedback
            </Button>
          </Link>
        </div>
      </div>



      <SwapModal 
        isOpen={isSwapModalOpen} 
        onClose={() => setIsSwapModalOpen(false)} 
      />
      <YieldCalculatorModal 
        isOpen={isYieldCalcOpen}
        onClose={() => setIsYieldCalcOpen(false)}
        totalAssets={totalAssets}
        walletTotal={walletTotal}
      />
    </div>
  );
} 