'use client';

import React from 'react';
import { YieldIdeas } from './InvestmentsDashboard';

export default function DashboardPanel() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>
      <YieldIdeas />
    </div>
  );
} 