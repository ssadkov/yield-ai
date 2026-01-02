'use client';

import { Suspense } from 'react';
import ChatPanel from './ChatPanel';

export default function ChatPanelWrapper() {
  return (
    <Suspense fallback={<div className="p-4">Loading...</div>}>
      <ChatPanel />
    </Suspense>
  );
}

