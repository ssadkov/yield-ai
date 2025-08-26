'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SwapModal } from '@/components/ui/swap-modal';
import { YieldCalculatorModal } from '@/components/ui/yield-calculator-modal';

export default function ChatPanel() {
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isYieldCalcOpen, setIsYieldCalcOpen] = useState(false);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Yield AI – All-in-One DeFi Dashboard for Maximizing Yields on Aptos
      </p>
      <p className="text-sm text-muted-foreground mt-4">
        New AI features will be here soon, and for now, we would be happy to get your{' '}
        <a
          href="https://forms.gle/NEpu5DjsmhVUprA5A"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          feedback
        </a>
      </p>
      <div className="mt-4 flex flex-col items-center gap-4">
        <div className="flex gap-2">
          <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
            <Button>Share Feedback</Button>
          </Link>
          <Button 
            variant="outline" 
            onClick={() => setIsSwapModalOpen(true)}
          >
            Swap
          </Button>
          <Button 
            variant="outline" 
            onClick={() => setIsYieldCalcOpen(true)}
          >
            Yield Calculator
          </Button>
        </div>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link
              href="https://x.com/yieldai_app"
              target="_blank"
              rel="noopener noreferrer"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Yield AI
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">Follow our updates</p>
              </CardContent>
            </Link>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link
              href="https://x.com/ssadkov"
              target="_blank"
              rel="noopener noreferrer"
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Founder
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground">Follow the founder</p>
              </CardContent>
            </Link>
          </Card>
        </div>
      </div>

      {/* Mobile home icon - bottom of feedback block */}
      <div className="mt-6 flex justify-center md:hidden">
        <Link 
          href="https://home.yieldai.app/" 
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          title="Yield AI Home"
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
        </Link>
      </div>

      <SwapModal 
        isOpen={isSwapModalOpen} 
        onClose={() => setIsSwapModalOpen(false)} 
      />
      <YieldCalculatorModal 
        isOpen={isYieldCalcOpen}
        onClose={() => setIsYieldCalcOpen(false)}
      />
    </div>
  );
} 