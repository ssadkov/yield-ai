'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TestTube, 
  Zap, 
  Coins, 
  TrendingUp, 
  Database, 
  Settings,
  ArrowLeftRight,
  Wallet,
  Store,
  Shield,
  Globe
} from 'lucide-react';

const testPages = [
  {
    name: 'Test Progressive Loading',
    description: 'Test progressive loading of pools',
    path: '/test-progressive-loading',
    icon: Zap,
    badge: 'New',
    color: 'bg-emerald-500'
  },
  {
    name: 'Test Debug',
    description: 'Debug API calls',
    path: '/test-debug',
    icon: Settings,
    color: 'bg-red-500'
  },
  {
    name: 'Test Swap',
    description: 'Test Hyperion swap functionality',
    path: '/test-swap',
    icon: ArrowLeftRight,
    badge: 'New',
    color: 'bg-blue-500'
  },
  {
    name: 'Test Panora',
    description: 'Test Panora token list and wallet tokens',
    path: '/test-panora',
    icon: Globe,
    badge: 'New',
    color: 'bg-cyan-500'
  },
  {
    name: 'Test Panora Prices',
    description: 'Test Panora API price fetching with address normalization',
    path: '/test-panora-prices',
    icon: Coins,
    badge: 'Debug',
    color: 'bg-amber-500'
  },
  {
    name: 'Test Token Lookup',
    description: 'Test universal token lookup with protocol API fallbacks (Echelon, Panora)',
    path: '/test-token-lookup',
    icon: Coins,
    badge: 'New',
    color: 'bg-green-500'
  },
  {
    name: 'Test Echelon Positions',
    description: 'Test how EchelonPositions component loads token info with fallback',
    path: '/test-echelon-positions',
    icon: Coins,
    badge: 'New',
    color: 'bg-blue-500'
  },
  {
    name: 'Test Hyperion',
    description: 'Test Hyperion pools integration',
    path: '/test-hyperion',
    icon: Zap,
    color: 'bg-purple-500'
  },
  {
    name: 'Test Pools',
    description: 'Test custom pool integrations',
    path: '/test-pools',
    icon: Coins,
    color: 'bg-green-500'
  },
  {
    name: 'Test Auro',
    description: 'Test Auro Finance integration',
    path: '/test-auro',
    icon: TrendingUp,
    color: 'bg-orange-500'
  },
  {
    name: 'Test Resources',
    description: 'Test resource parsing and formatting',
    path: '/test-resources',
    icon: Database,
    color: 'bg-red-500'
  },
  {
    name: 'Test Integration',
    description: 'Test general integration features',
    path: '/test-integration',
    icon: Settings,
    color: 'bg-gray-500'
  },
  {
    name: 'Test Zustand',
    description: 'Test Zustand state management stores',
    path: '/test-zustand',
    icon: Store,
    color: 'bg-indigo-500'
  },
  {
    name: 'Test Wallet Store',
    description: 'Test centralized wallet data management',
    path: '/test-wallet-store',
    icon: Wallet,
    color: 'bg-green-500'
  },
  {
    name: 'Test Echelon',
    description: 'Test Echelon protocol integration',
    path: '/test-echelon',
    icon: Shield,
    color: 'bg-yellow-500'
  },
  {
    name: 'Test KoFi Pools',
    description: 'Test KoFi Finance staking pools integration',
    path: '/test-kofi-pools',
    icon: Coins,
    badge: 'New',
    color: 'bg-emerald-600'
  },
  {
    name: 'Test Aave',
    description: 'Test Aave protocol integration',
    path: '/test-aave',
    icon: Shield,
    badge: 'New',
    color: 'bg-blue-600'
  }
];

export function TestNavigation() {
  const pathname = usePathname();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Test Pages</h1>
        <p className="text-muted-foreground">
          Development and testing interface for Yield AI features
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testPages.map((page) => {
          const Icon = page.icon;
          const isActive = pathname === page.path;
          
          return (
            <Link key={page.path} href={page.path}>
              <Card className={`hover:shadow-lg transition-all duration-200 cursor-pointer ${
                isActive ? 'ring-2 ring-primary' : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-lg ${page.color}`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    {page.badge && (
                      <Badge variant="secondary" className="text-xs">
                        {page.badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{page.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    {page.description}
                  </p>
                  <Button 
                    variant={isActive ? "default" : "outline"} 
                    size="sm" 
                    className="w-full"
                  >
                    {isActive ? 'Current Page' : 'Open Test'}
                  </Button>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <TestTube className="h-4 w-4" />
          <span className="font-medium">Development Notes</span>
        </div>
        <p className="text-sm text-muted-foreground">
          These pages are for development and testing purposes. They provide interfaces to test 
          various integrations, APIs, and features before they are integrated into the main application.
        </p>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Configuration & Debug</h3>
        <div className="space-y-2">
          <Link href="/test-config" className="block p-2 bg-blue-100 hover:bg-blue-200 rounded">
            Test Config & Environment
          </Link>
          <Link href="/test-api-endpoints" className="block p-2 bg-blue-100 hover:bg-blue-200 rounded">
            Test API Endpoints
          </Link>
        </div>
      </div>
    </div>
  );
} 