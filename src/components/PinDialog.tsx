import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

type Scope = "admin" | "date_override" | "delete_confirm" | "qr_checker";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  scope: Scope;
  title?: string;
  description?: string;
  /** Receives the issued admin token when scope === "admin", otherwise undefined. */
  onSuccess: (token?: string) => void;
}

export function PinDialog({
  open,
  onOpenChange,
  scope,
  title = "Enter PIN",
  description = "Enter your PIN to continue.",
  onSuccess,
}: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.verifyPin(scope, pin);
      if (!res.ok) {
        setError("Incorrect PIN");
        setBusy(false);
        return;
      }
      setPin("");
      setBusy(false);
      onOpenChange(false);
      onSuccess(res.token);
    } catch (err: any) {
      setError(err?.message ?? "Verification failed");
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setPin("");
          setError("");
        }
        onOpenChange(o);
      }}
    >
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
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            placeholder="••••••••"
            className="text-center text-lg tracking-widest"
            disabled={busy}
          />
          {error && <p className="text-destructive text-sm text-center">{error}</p>}
          <Button
            type="submit"
            className="w-full bg-gradient-primary hover:opacity-90"
            disabled={!pin || busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
