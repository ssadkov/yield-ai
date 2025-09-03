'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { isValidAptosAddress, isPotentialDomainName, resolveAddressFromName } from '@/lib/utils/aptosNames';

import { Wallet, Search } from 'lucide-react';

export default function WalletPage() {
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateInput = (input: string): boolean => {
    // Check if it's a valid Aptos address
    if (isValidAptosAddress(input)) {
      return true;
    }
    
    // Check if it's a potential domain name (contains . and doesn't start with 0x)
    if (isPotentialDomainName(input)) {
      return true;
    }
    
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!address.trim()) {
      setError('Please enter a wallet address or domain name');
      return;
    }

    const cleanInput = address.trim();
    
    if (!validateInput(cleanInput)) {
      setError('Invalid Aptos wallet address or domain format');
      return;
    }

    setIsLoading(true);
    
    try {
      let finalAddress = cleanInput;
      
      // If it's a domain name, resolve it to address
      if (isPotentialDomainName(cleanInput)) {
        const resolvedAddress = await resolveAddressFromName(cleanInput);
        if (!resolvedAddress) {
          setError(`Domain "${cleanInput}" not found or invalid`);
          setIsLoading(false);
          return;
        }
        finalAddress = resolvedAddress;
      }

      // Navigate to wallet view page
      router.push(`/portfolio/${finalAddress}`);
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
                Enter an Aptos wallet address or domain name to view its balance and positions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="address"
                      type="text"
                      placeholder="Enter Aptos address or domain (e.g., defishow.petra.apt)..."
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

                             <div className="mt-6  text-sm text-gray-500 overflow-hidden">
                 <p className="mb-2">Examples:</p>
                 <p>Address: 0x4ade47d86d1013af5a0e38bbbd5d745a72cf4b9fa9759f4a5f7434b15bb1fbd1</p>
                 <p>Domain: defishow.petra.apt</p>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 