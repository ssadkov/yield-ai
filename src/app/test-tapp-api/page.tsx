'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TestTappApiPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const testDirectApi = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      console.log('Testing direct Tapp API...');
      
      const requestBody = {
        method: "public/pool",
        jsonrpc: "2.0",
        id: 4,
        params: {
          query: {
            page: 1,
            pageSize: 10
          }
        }
      };
      
      const response = await fetch('https://api.tapp.exchange/api/v1', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Direct API response:', responseData);
      setData(responseData);
      
    } catch (err) {
      console.error('Error testing direct API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const testOurApi = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    
    try {
      console.log('Testing our Tapp API wrapper...');
      const response = await fetch('/api/protocols/tapp/pools?chain=aptos&page=1&limit=10');
      
      console.log('Our API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Our API Error Response:', errorText);
        throw new Error(`Our API returned ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('Our API response:', responseData);
      setData(responseData);
      
    } catch (err) {
      console.error('Error testing our API:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Test Tapp Exchange API</h1>
        <p className="text-muted-foreground">
          Test direct API calls to Tapp Exchange and our wrapper
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Button 
              onClick={testDirectApi} 
              disabled={loading}
              variant="outline"
            >
              Test Direct API
            </Button>
            <Button 
              onClick={testOurApi} 
              disabled={loading}
            >
              Test Our API Wrapper
            </Button>
          </div>
          
          {loading && (
            <div className="text-center py-4">Loading...</div>
          )}
          
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-red-600 font-medium">Error: {error}</div>
              </CardContent>
            </Card>
          )}
          
          {data && (
            <Card>
              <CardHeader>
                <CardTitle>API Response</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 