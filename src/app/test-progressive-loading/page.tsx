'use client';

import { InvestmentsDashboard } from '@/components/InvestmentsDashboard';

export default function TestProgressiveLoadingPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Progressive Loading</h1>
      <InvestmentsDashboard />
    </div>
  );
} 