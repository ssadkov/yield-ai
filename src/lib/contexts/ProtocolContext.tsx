'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Protocol } from '@/lib/protocols/getProtocolsList';

interface ProtocolContextType {
  selectedProtocol: Protocol | null;
  setSelectedProtocol: (protocol: Protocol | null) => void;
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

export function ProtocolProvider({ children }: { children: ReactNode }) {
  const [selectedProtocol, setSelectedProtocol] = useState<Protocol | null>(null);

  return (
    <ProtocolContext.Provider value={{ selectedProtocol, setSelectedProtocol }}>
      {children}
    </ProtocolContext.Provider>
  );
}

export function useProtocol() {
  const context = useContext(ProtocolContext);
  if (context === undefined) {
    throw new Error('useProtocol must be used within a ProtocolProvider');
  }
  return context;
} 