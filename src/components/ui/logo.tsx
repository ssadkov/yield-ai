import { cn } from "@/lib/utils";
import Image from "next/image";
import { useState, useEffect } from "react";
import { getOptimizedImageUrl, isMainDomain, preloadCriticalResources } from "@/lib/utils/domainUtils";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md", ...props }: LogoProps) {
  const [imageError, setImageError] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [imageSrc, setImageSrc] = useState('/logo.png');

  // Ensure we're on client side
  useEffect(() => {
    setIsClient(true);
    
    // Preload critical resources for main domain
    if (isMainDomain()) {
      preloadCriticalResources();
    }
  }, []);

  // Handle image error with retry for main domain
  const handleImageError = () => {
    if (isMainDomain() && !imageError) {
      // Try with cache busting parameter
      const newSrc = getOptimizedImageUrl('/logo.png');
      if (newSrc !== imageSrc) {
        setImageSrc(newSrc);
        return;
      }
    }
    setImageError(true);
  };

  if (!isClient) {
    // Server-side fallback
    return (
      <div
        className={cn(
          "relative bg-muted rounded flex items-center justify-center",
          {
            "h-6 w-6": size === "sm",
            "h-8 w-8": size === "md",
            "h-10 w-10": size === "lg",
          },
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold text-foreground">Y</span>
      </div>
    );
  }

  if (imageError) {
    // Fallback when image fails to load
    return (
      <div
        className={cn(
          "relative bg-muted rounded flex items-center justify-center",
          {
            "h-6 w-6": size === "sm",
            "h-8 w-8": size === "md",
            "h-10 w-10": size === "lg",
          },
          className
        )}
        {...props}
      >
        <span className="text-xs font-bold text-foreground">Y</span>
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
        src={imageSrc}
        alt="Yield AI Logo"
        fill
        className="object-contain"
        onError={handleImageError}
        priority={isMainDomain()}
        sizes="(max-width: 768px) 24px, (max-width: 1200px) 32px, 40px"
        quality={isMainDomain() ? 90 : 75}
      />
    </div>
  );
} 