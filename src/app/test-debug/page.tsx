'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestDebugPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testAPI = async (url: string, name: string) => {
    try {
      console.log(`Testing ${name}...`);
      const response = await fetch(url);
      const result = await response.json();
      console.log(`${name} result:`, result);
      return { name, success: true, data: result };
    } catch (err) {
      console.error(`${name} error:`, err);
      return { name, success: false, error: err };
    }
  };

  const testAllAPIs = async () => {
    setLoading(true);
    setError(null);
    setData(null);

    const apis = [
      { url: '/api/protocols/hyperion/pools', name: 'Hyperion' },
      { url: '/api/protocols/auro/pools', name: 'Auro' },
      { url: '/api/protocols/tapp/pools', name: 'Tapp' },
      { url: '/api/protocols/amnis/pools', name: 'Amnis' }
    ];

    const results = await Promise.allSettled(
      apis.map(api => testAPI(api.url, api.name))
    );

    const successfulResults = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    setData(successfulResults);
    setLoading(false);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Debug API Test</h1>
      
      <button 
        onClick={testAllAPIs}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test All APIs'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <h2 className="text-xl font-semibold">Results:</h2>
          {data.map((result: any, index: number) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>{result.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs overflow-auto">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 