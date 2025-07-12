'use client';

import { useState } from 'react';
import { parseMesoPosition, formatMesoPosition } from '@/lib/protocols/meso/parser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Twitter, MessageCircle } from 'lucide-react';
import Link from 'next/link';

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
    <div className="container mx-auto p-6 max-w-6xl">
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

      {/* Twitter Links Variants */}
      <div className="mt-12 border-t pt-8">
        <h2 className="text-2xl font-bold mb-6">Twitter Links Variants</h2>
        
        {/* Variant 1: Button with asChild */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 1: Button with asChild</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-3">
                <Button asChild variant="outline" size="icon" className="rounded-full">
                  <Link
                    href="https://x.com/FinKeeper"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Twitter className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="icon" className="rounded-full">
                  <Link
                    href="https://x.com/ssadkov"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Twitter className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 2: Card components */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 2: Card components</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <Link
                    href="https://x.com/FinKeeper"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Yield AI
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">Follow our updates</p>
                    </CardContent>
                  </Link>
                </Card>
                
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <Link
                    href="https://x.com/ssadkov"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <svg className="h-4 w-4 text-black" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Founder
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground">Follow the founder</p>
                    </CardContent>
                  </Link>
                </Card>
              </div>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 3: Badge with asChild */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 3: Badge with asChild</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-3">
                <Badge asChild variant="outline" className="cursor-pointer hover:bg-accent">
                  <Link
                    href="https://x.com/FinKeeper"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Twitter className="h-3 w-3" />
                    Yield AI
                  </Link>
                </Badge>
                
                <Badge asChild variant="outline" className="cursor-pointer hover:bg-accent">
                  <Link
                    href="https://x.com/ssadkov"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Twitter className="h-3 w-3" />
                    Founder
                  </Link>
                </Badge>
              </div>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 4: With Tooltip */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 4: With Tooltip</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="rounded-full">
                      <Link
                        href="https://x.com/FinKeeper"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Twitter className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow Yield AI Project</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="rounded-full">
                      <Link
                        href="https://x.com/ssadkov"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Twitter className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow Founder</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 5: Combined approach */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 5: Combined approach</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <Card className="w-full max-w-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">Connect with us</span>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Link
                          href="https://x.com/FinKeeper"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Twitter className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <Link
                          href="https://x.com/ssadkov"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Twitter className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 6: Simple horizontal layout */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 6: Simple horizontal layout</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-6">
                <Link
                  href="https://x.com/FinKeeper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                  <span className="text-sm font-medium">Follow Yield AI</span>
                </Link>
                <Link
                  href="https://x.com/ssadkov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <Twitter className="w-5 h-5" />
                  <span className="text-sm font-medium">Follow Founder</span>
                </Link>
              </div>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Variant 7: Styled cards with labels */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Variant 7: Styled cards with labels</h3>
          <div className="p-6 border rounded-lg bg-gray-50">
            <div className="flex flex-col items-center gap-4">
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                <Link
                  href="https://x.com/FinKeeper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-black text-white rounded-full mb-2">
                    <Twitter className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Yield AI</span>
                </Link>
                <Link
                  href="https://x.com/ssadkov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="p-3 bg-black text-white rounded-full mb-2">
                    <Twitter className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium">Founder</span>
                </Link>
              </div>
              
              <Link href="https://forms.gle/NEpu5DjsmhVUprA5A" passHref target="_blank" rel="noopener noreferrer">
                <Button>Share Feedback</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 