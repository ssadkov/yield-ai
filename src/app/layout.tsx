import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { WalletProvider } from "@/lib/WalletProvider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Yield AI Agent",
  description: "DeFi assistant on Aptos",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <WalletProvider>
          {children}
          <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
