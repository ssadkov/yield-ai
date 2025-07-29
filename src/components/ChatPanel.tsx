'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ChatPanel() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Yield AI – All-in-One DeFi Dashboard for Maximizing Yields on Aptos
      </p>
      <div className="mt-3 mb-4 flex justify-center">
        <a 
          href="https://app.auro.finance?ref=YieldAI" 
          target="_blank" 
          rel="noopener noreferrer"
          className="block hover:opacity-80 transition-opacity"
        >
          <img 
            src="/YieldAIxAUROFinance.png" 
            alt="Yield AI x Auro Finance Partnership" 
            className="h-60 md:h-90 w-auto object-contain max-w-full"
          />
        </a>
      </div>
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
        <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
          <Button>Share Feedback</Button>
        </Link>
        
        <div className="grid grid-cols-2 gap-4 w-full max-w-md">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <Link
              href="https://x.com/FinKeeper"
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
    </div>
  );
} 