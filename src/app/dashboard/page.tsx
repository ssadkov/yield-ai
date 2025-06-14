import { InvestmentsDashboard } from '@/components/InvestmentsDashboard';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <InvestmentsDashboard />
    </div>
  );
} 