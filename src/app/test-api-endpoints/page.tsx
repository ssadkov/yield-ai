'use client';

import React, { useState } from 'react';
import { getBaseUrl } from '@/lib/utils/config';

export default function TestApiEndpointsPage() {
  const [testAddress] = useState('0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef');
  const [results, setResults] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testEndpoint = async (protocol: string, endpoint: string) => {
    const url = `${getBaseUrl()}/api/protocols/${protocol}/${endpoint}?address=${testAddress}`;
    console.log(`Testing ${protocol} ${endpoint}:`, url);
    
    try {
      const startTime = Date.now();
      const response = await fetch(url);
      const endTime = Date.now();
      
      const result = {
        url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        responseTime: endTime - startTime,
        headers: Object.fromEntries(response.headers.entries())
      };
      
      if (response.ok) {
        try {
          const data = await response.json();
          result.data = data;
        } catch (e) {
          result.parseError = 'Failed to parse JSON response';
        }
      } else {
        try {
          const errorText = await response.text();
          result.errorBody = errorText;
        } catch (e) {
          result.errorBody = 'Could not read error response';
        }
      }
      
      return result;
    } catch (error) {
      return {
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      };
    }
  };

  const runAllTests = async () => {
    setLoading(true);
    setResults({});
    
    const protocols = [
      { name: 'echelon', endpoint: 'rewards' },
      { name: 'auro', endpoint: 'rewards' },
      { name: 'hyperion', endpoint: 'userPositions' },
      { name: 'meso', endpoint: 'rewards' }
    ];
    
    const testResults: any = {};
    
    for (const protocol of protocols) {
      console.log(`Testing ${protocol.name}...`);
      const result = await testEndpoint(protocol.name, protocol.endpoint);
      testResults[protocol.name] = result;
      
      // Wait a bit between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    setResults(testResults);
    setLoading(false);
    console.log('All tests completed:', testResults);
  };

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">API Endpoints Test</h1>
      
      <div className="mb-6">
        <div className="bg-blue-100 p-4 rounded mb-4">
          <h2 className="font-semibold mb-2">Configuration</h2>
          <div><strong>Base URL:</strong> {getBaseUrl()}</div>
          <div><strong>Test Address:</strong> {testAddress}</div>
        </div>
        
        <button
          onClick={runAllTests}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Run All Tests'}
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(results).map(([protocol, result]: [string, any]) => (
          <div key={protocol} className="border rounded p-4">
            <h3 className="font-semibold text-lg mb-2 capitalize">{protocol}</h3>
            
            <div className="space-y-2 text-sm">
              <div><strong>URL:</strong> {result.url}</div>
              <div><strong>Status:</strong> {result.status} {result.statusText}</div>
              <div><strong>Response Time:</strong> {result.responseTime}ms</div>
              <div><strong>Success:</strong> {result.ok ? '✅ Yes' : '❌ No'}</div>
              
              {result.headers && (
                <div>
                  <strong>Headers:</strong>
                  <pre className="bg-gray-100 p-2 rounded text-xs mt-1">
                    {JSON.stringify(result.headers, null, 2)}
                  </pre>
                </div>
              )}
              
              {result.data && (
                <div>
                  <strong>Response Data:</strong>
                  <pre className="bg-green-100 p-2 rounded text-xs mt-1 max-h-40 overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </div>
              )}
              
              {result.errorBody && (
                <div>
                  <strong>Error Response:</strong>
                  <pre className="bg-red-100 p-2 rounded text-xs mt-1 max-h-40 overflow-auto">
                    {result.errorBody}
                  </pre>
                </div>
              )}
              
              {result.error && (
                <div>
                  <strong>Error:</strong>
                  <div className="bg-red-100 p-2 rounded text-xs mt-1">
                    {result.error}
                  </div>
                  {result.stack && (
                    <pre className="bg-red-100 p-2 rounded text-xs mt-1 max-h-40 overflow-auto">
                      {result.stack}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
