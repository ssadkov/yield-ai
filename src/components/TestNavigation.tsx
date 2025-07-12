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
  Wallet
} from 'lucide-react';

const testPages = [
  {
    name: 'Test Swap',
    description: 'Test Hyperion swap functionality',
    path: '/test-swap',
    icon: ArrowLeftRight,
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
    </div>
  );
} 