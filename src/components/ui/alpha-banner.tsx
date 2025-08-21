"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

export function AlphaBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Проверяем, видел ли пользователь баннер ранее
    const hasSeenBanner = localStorage.getItem("alpha-banner-dismissed");
    if (!hasSeenBanner) {
      setIsVisible(true);
    }
  }, []);

  const dismissBanner = () => {
    setIsVisible(false);
    localStorage.setItem("alpha-banner-dismissed", "true");
  };

  if (!isVisible) return null;

  return (
    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-blue-200/50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-3 text-sm text-blue-800 relative">
          <span className="animate-pulse">🧪</span>
          <span className="font-medium">We've moved from ai.finkeeper.pro to yieldai.app</span>
          <span className="animate-pulse">🚀</span>
          
          <button
            onClick={dismissBanner}
            className="absolute right-0 p-1 hover:bg-blue-100 rounded-full transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
} 