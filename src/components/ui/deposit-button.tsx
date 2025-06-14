import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { Protocol } from "@/lib/protocols/getProtocolsList";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface DepositButtonProps {
  protocol: Protocol;
  className?: string;
}

export function DepositButton({ protocol, className }: DepositButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleClick = () => {
    if (protocol.depositType === 'external') {
      setIsDialogOpen(true);
    } else {
      // TODO: Handle native deposit
      console.log('Native deposit for', protocol.name);
    }
  };

  const handleConfirm = () => {
    if (protocol.depositUrl) {
      window.open(protocol.depositUrl, '_blank');
    }
    setIsDialogOpen(false);
  };

  return (
    <>
      <Button 
        variant="secondary" 
        className={className}
        onClick={handleClick}
      >
        Deposit
        {protocol.depositType === 'external' && (
          <ExternalLink className="ml-2 h-4 w-4" />
        )}
      </Button>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Go to protocol website?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to {protocol.name} website to complete the deposit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
} 