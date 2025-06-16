import { Button } from "@/components/ui/button";
import { Settings, ExternalLink } from "lucide-react";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import { useProtocol } from "@/lib/contexts/ProtocolContext";

interface ManagePositionsButtonProps {
  protocol: Protocol;
}

export function ManagePositionsButton({ protocol }: ManagePositionsButtonProps) {
  const { setSelectedProtocol } = useProtocol();

  const handleClick = () => {
    if (protocol.managedType === "native") {
      setSelectedProtocol(protocol);
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else if (protocol.managedType === "external" && protocol.url) {
      window.open(protocol.url, "_blank");
    }
  };

  return (
    <div className="flex justify-center mt-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-2"
        onClick={handleClick}
      >
        <Settings className="h-4 w-4" />
        Manage Positions
        {protocol.managedType === "external" && (
          <ExternalLink className="h-4 w-4 ml-1" />
        )}
      </Button>
    </div>
  );
} 