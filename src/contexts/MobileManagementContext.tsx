"use client";
import { createContext, useContext, ReactNode } from "react";

interface MobileManagementContextType {
  setActiveTab: ((tab: "ideas" | "assets" | "chat") => void) | null;
  scrollToTop: (() => void) | null;
  goToAssets: (() => void) | null;
}

const MobileManagementContext = createContext<MobileManagementContextType | undefined>(undefined);

export function MobileManagementProvider({ 
  children, 
  setActiveTab,
  scrollToTop,
  goToAssets
}: { 
  children: ReactNode;
  setActiveTab: (tab: "ideas" | "assets" | "chat") => void;
  scrollToTop: () => void;
  goToAssets: () => void;
}) {
  return (
    <MobileManagementContext.Provider value={{ setActiveTab, scrollToTop, goToAssets }}>
      {children}
    </MobileManagementContext.Provider>
  );
}

export function useMobileManagement() {
  const context = useContext(MobileManagementContext);
  if (context === undefined) {
    return {
      setActiveTab: null,
      scrollToTop: null,
      goToAssets: null
    };
  }
  return context;
} 