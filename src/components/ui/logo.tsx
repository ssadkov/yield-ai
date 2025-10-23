import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState, useEffect } from "react";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md", ...props }: LogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Server-side fallback
    return (
      <div
        className={cn(
          "relative bg-gray-200 rounded flex items-center justify-center",
          {
            "h-6 w-6": size === "sm",
            "h-8 w-8": size === "md",
            "h-10 w-10": size === "lg",
          },
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold text-gray-600">Y</span>
      </div>
    );
  }

  if (imageError) {
    // Fallback when image fails to load
    return (
      <div
        className={cn(
          "relative bg-gray-200 rounded flex items-center justify-center",
          {
            "h-6 w-6": size === "sm",
            "h-8 w-8": size === "md",
            "h-10 w-10": size === "lg",
          },
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold text-gray-600">Y</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative",
        {
          "h-6 w-6": size === "sm",
          "h-8 w-8": size === "md",
          "h-10 w-10": size === "lg",
        },
        className
      )}
      {...props}
    >
      <Image
        src="/logo.png"
        alt="Yield AI Logo"
        fill
        className="object-contain"
        onError={() => setImageError(true)}
        priority
        sizes="(max-width: 768px) 24px, (max-width: 1200px) 32px, 40px"
      />
    </div>
  );
} 