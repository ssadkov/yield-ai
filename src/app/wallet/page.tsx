'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

import { Wallet, Search } from 'lucide-react';

export default function WalletPage() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateAptosAddress = (addr: string): boolean => {
    // Remove 0x prefix if present
    const cleanAddr = addr.startsWith('0x') ? addr.slice(2) : addr;
    // Aptos addresses are 64 characters long and contain only hex characters
    const aptosAddressRegex = /^[0-9a-fA-F]{64}$/;
    return aptosAddressRegex.test(cleanAddr);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!address.trim()) {
      setError('Please enter a wallet address');
      return;
    }

    const cleanAddress = address.trim();
    
    if (!validateAptosAddress(cleanAddress)) {
      setError('Invalid Aptos wallet address format');
      return;
    }

    // Normalize address (remove 0x prefix if present)
    const normalizedAddress = cleanAddress.startsWith('0x') ? cleanAddress.slice(2) : cleanAddress;

    setIsLoading(true);
    
    try {
      // Navigate to wallet view page
      router.push(`/wallet/${normalizedAddress}`);
    } catch (err) {
      setError('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-2xl font-bold">Wallet Explorer</CardTitle>
              <CardDescription>
                Enter an Aptos wallet address to view its balance and positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Wallet Address</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="address"
                      type="text"
                      placeholder="Enter 64-character Aptos address..."
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'View Wallet'}
                </Button>
              </form>

                             <div className="mt-6 text-center text-sm text-gray-500">
                 <p>Example: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef</p>
                 <p className="mt-1">Or: 1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef</p>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 