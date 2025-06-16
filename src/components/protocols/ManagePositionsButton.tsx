import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Protocol } from "@/lib/protocols/getProtocolsList";

interface ManagePositionsButtonProps {
  protocol: Protocol;
}

export function ManagePositionsButton({ protocol }: ManagePositionsButtonProps) {
  const handleClick = () => {
    if (protocol.managedType === "native") {
      alert(`Manage positions for ${protocol.name}`);
    } else if (protocol.managedType === "external" && protocol.url) {
      window.open(protocol.url, "_blank");
    }
  };

  return (
    <Button
      variant="secondary"
      className="w-full justify-start mt-2 gap-2"
      onClick={handleClick}
    >
      <Settings className="h-4 w-4" />
      Manage Positions
    </Button>
  );
} 