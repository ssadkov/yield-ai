'use client';

import { useState } from 'react';
import { parseMesoPosition, formatMesoPosition } from '@/lib/protocols/meso/parser';

export default function TestResourcesPage() {
  const [address, setAddress] = useState('0x88fbd33f54e1126269769780feb24480428179f552e2313fbe571b72e62a1ca1');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mesoParsed, setMesoParsed] = useState<any>(null);
  const [mesoFormatted, setMesoFormatted] = useState<string>('');

  const testAPI = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMesoParsed(null);
    setMesoFormatted('');

    try {
      const response = await fetch('/api/aptos/resources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
        
        // Parse Meso Finance positions if found
        const mesoResource = data.data?.find((resource: any) => 
          resource.type === '0x68476f9d437e3f32fd262ba898b5e3ee0a23a1d586a6cf29a28add35f253f6f7::lending_pool::UserPosition'
        );
        
        if (mesoResource) {
          const parsed = parseMesoPosition(mesoResource.data);
          setMesoParsed(parsed);
          
          if (parsed) {
            const formatted = formatMesoPosition(parsed);
            setMesoFormatted(formatted);
          }
        }
      } else {
        setError(data.error || 'Request failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Test Aptos Resources API</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Aptos Address:
        </label>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
          placeholder="Enter Aptos address"
        />
      </div>

      <button
        onClick={testAPI}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Loading...' : 'Test API'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {mesoFormatted && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Meso Finance Position:</h2>
          <div className="bg-green-100 p-4 rounded-md border border-green-400">
            <strong>Parsed:</strong> {mesoFormatted}
          </div>
        </div>
      )}

      {mesoParsed && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">Meso Finance Parsed Data:</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-96 text-sm">
            {JSON.stringify(mesoParsed, null, 2)}
          </pre>
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-4">API Response:</h2>
          <pre className="bg-gray-100 p-4 rounded-md overflow-auto max-h-96 text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 