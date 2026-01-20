import { Suspense } from 'react';
import PortfolioPage from '@/components/PortfolioPage';

export default function Dashboard2Page() {
  return (
    <div className="container mx-auto py-2">
      <Suspense fallback={<div className="p-4">Loading...</div>}>
        <PortfolioPage />
      </Suspense>
    </div>
  );
} 