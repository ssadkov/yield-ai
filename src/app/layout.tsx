import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WalletProvider } from "@/lib/WalletProvider";
import { WalletDataProvider } from "@/contexts/WalletContext";
import { ProtocolProvider } from "@/lib/contexts/ProtocolContext";
import { DragDropProvider } from "@/contexts/DragDropContext";
import { Toaster } from "@/components/ui/toaster";
import { AlphaBanner } from "@/components/ui/alpha-banner";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WalletProvider>
          <WalletDataProvider>
            <ProtocolProvider>
              <DragDropProvider>
                <AlphaBanner />
                {children}
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
