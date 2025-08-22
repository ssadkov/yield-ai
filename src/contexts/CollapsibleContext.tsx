"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CollapsibleContextType {
  expandedSections: Set<string>;
  toggleSection: (sectionId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  isExpanded: (sectionId: string) => boolean;
}

const CollapsibleContext = createContext<CollapsibleContextType | undefined>(undefined);

interface CollapsibleProviderProps {
  children: ReactNode;
}

export function CollapsibleProvider({ children }: CollapsibleProviderProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['wallet', 'hyperion', 'echelon', 'aries', 'joule', 'tapp', 'meso', 'auro', 'amnis', 'aave']));

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const expandAll = () => {
    setExpandedSections(new Set(['wallet', 'hyperion', 'echelon', 'aries', 'joule', 'tapp', 'meso', 'auro', 'amnis', 'aave']));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  const isExpanded = (sectionId: string) => {
    return expandedSections.has(sectionId);
  };

  return (
    <CollapsibleContext.Provider value={{
      expandedSections,
      toggleSection,
      expandAll,
      collapseAll,
      isExpanded
    }}>
      {children}
    </CollapsibleContext.Provider>
  );
}

export function useCollapsible() {
  const context = useContext(CollapsibleContext);
  if (context === undefined) {
    throw new Error('useCollapsible must be used within a CollapsibleProvider');
  }
  return context;
} 