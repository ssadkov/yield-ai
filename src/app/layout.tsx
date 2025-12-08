import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { WalletProvider } from "@/lib/WalletProvider";
import { WalletDataProvider } from "@/contexts/WalletContext";
import { ProtocolProvider } from "@/lib/contexts/ProtocolContext";
import { DragDropProvider } from "@/contexts/DragDropContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
//import { AlphaBanner } from "@/components/ui/alpha-banner";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Yield AI",
  description: "AI-powered yield farming platform",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon-16x16.png',
      },
      {
        rel: 'android-chrome-192x192',
        url: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        rel: 'android-chrome-512x512',
        url: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WalletProvider>
          <WalletDataProvider>
            <ProtocolProvider>
              <DragDropProvider>
                <TooltipProvider>
                  {/*<AlphaBanner />*/}
                  {children}
                
                {/* Fixed home icon in bottom right corner - desktop only */}
                <Link 
                  href="https://home.yieldai.app/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fixed bottom-4 right-4 z-50 p-1 text-gray-400 hover:text-gray-600 transition-colors hidden md:block"
                  title="Yield AI Home"
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </Link>
                </TooltipProvider>
              </DragDropProvider>
            </ProtocolProvider>
          </WalletDataProvider>
          <Toaster />
        </WalletProvider>
        <Analytics />
      </body>
    </html>
  );
}
