import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expectedPin: string;
  title?: string;
  description?: string;
  onSuccess: () => void;
}

export function PinDialog({ open, onOpenChange, expectedPin, title = "Enter Admin PIN", description = "Enter your PIN to continue.", onSuccess }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === expectedPin) {
      setPin(""); setError(""); onOpenChange(false); onSuccess();
    } else {
      setError("Incorrect PIN");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(""); setError(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-primary flex items-center justify-center mb-2 shadow-festive">
            <Lock className="h-6 w-6 text-primary-foreground" />
          </div>
          <DialogTitle className="text-center font-display uppercase tracking-wide">{title}</DialogTitle>
          <DialogDescription className="text-center">{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Input
            autoFocus
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(""); }}
            placeholder="••••••••"
            className="text-center text-lg tracking-widest"
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button type="submit" className="w-full bg-gradient-primary hover:opacity-90" disabled={!pin}>
            Unlock
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
