import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Yield AI | Decibel funding chart',
};

export default function DecibelFundingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
