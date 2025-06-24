'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function ChatPanel() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Feedback</h1>
      <p className="text-sm text-muted-foreground">
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
        <Link
          href="https://dorahacks.io/aptos/round-8/buidl"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image src="/voting-yieldAI.png" alt="Vote for Yield AI" width={512} height={512} />
        </Link>
        <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
          <Button>Share Feedback</Button>
        </Link>
      </div>
    </div>
  );
} 