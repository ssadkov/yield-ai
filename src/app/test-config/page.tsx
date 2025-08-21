'use client';

import React, { useEffect, useState } from 'react';
import { getBaseUrl, isProduction, isVercel } from '@/lib/utils/config';

export default function TestConfigPage() {
  const [config, setConfig] = useState<any>({});

  useEffect(() => {
    setConfig({
      baseUrl: getBaseUrl(),
      isProduction: isProduction(),
      isVercel: isVercel(),
      env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        VERCEL_URL: process.env.VERCEL_URL,
        NODE_ENV: process.env.NODE_ENV,
      }
    });
  }, []);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Configuration Test</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Configuration Functions</h2>
          <pre className="text-sm">{JSON.stringify(config, null, 2)}</pre>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Environment Variables</h2>
          <div className="space-y-2">
            <div><strong>NEXT_PUBLIC_API_URL:</strong> {process.env.NEXT_PUBLIC_API_URL || 'Not set'}</div>
            <div><strong>VERCEL_URL:</strong> {process.env.VERCEL_URL || 'Not set'}</div>
            <div><strong>NODE_ENV:</strong> {process.env.NODE_ENV || 'Not set'}</div>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Test API Calls</h2>
          <div className="space-y-2">
            <div><strong>Base URL:</strong> {getBaseUrl()}</div>
            <div><strong>Echelon API:</strong> {getBaseUrl()}/api/protocols/echelon/rewards</div>
            <div><strong>Auro API:</strong> {getBaseUrl()}/api/protocols/auro/rewards</div>
            <div><strong>Hyperion API:</strong> {getBaseUrl()}/api/protocols/hyperion/userPositions</div>
            <div><strong>Meso API:</strong> {getBaseUrl()}/api/protocols/meso/rewards</div>
          </div>
        </div>
      </div>
    </div>
  );
}
