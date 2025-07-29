"use client";
import { createContext, useContext, ReactNode } from "react";

interface MobileManagementContextType {
  setActiveTab: ((tab: "ideas" | "assets" | "chat") => void) | null;
  scrollToTop: (() => void) | null;
}

const MobileManagementContext = createContext<MobileManagementContextType | undefined>(undefined);

export function MobileManagementProvider({ 
  children, 
  setActiveTab,
  scrollToTop
}: { 
  children: ReactNode;
  setActiveTab: (tab: "ideas" | "assets" | "chat") => void;
  scrollToTop: () => void;
}) {
  return (
    <MobileManagementContext.Provider value={{ setActiveTab, scrollToTop }}>
      {children}
    </MobileManagementContext.Provider>
  );
}

export function useMobileManagement() {
  const context = useContext(MobileManagementContext);
  if (context === undefined) {
    return {
      setActiveTab: null,
      scrollToTop: null
    };
  }
  return context;
} 