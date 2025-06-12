import { cn } from "@/lib/utils";
import Image from "next/image";

interface LogoProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md", ...props }: LogoProps) {
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
      />
    </div>
  );
} 