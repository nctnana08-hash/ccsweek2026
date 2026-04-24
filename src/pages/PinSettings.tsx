import { useEffect, useState } from "react";
import { useUpdatePins } from "@/hooks/useSettings";
import { useAdmin } from "@/stores/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bunting } from "@/components/Bunting";
import { Save, KeyRound, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const labels: Record<string, { title: string; desc: string }> = {
  admin: { title: "Admin Unlock", desc: "Unlocks Dashboard, Students, Events, Records, Absences, IPC, manual entry." },
  scanner_pin: { title: "Scanner PIN", desc: "Required to unlock and start scanning attendance." },
  date_override: { title: "Date Override", desc: "Required to record attendance outside the active event's day range." },
  delete_confirm: { title: "Delete Confirmation", desc: "Required when deleting students, attendance records, events, days, or slots." },
  qr_checker: { title: "QR Checker Access", desc: "Standalone utility to verify a roster against scans for a slot." },
};

export default function PinSettings() {
  const update = useUpdatePins();
  const { unlocked } = useAdmin();
  // PINs are no longer client-readable. We only allow setting new values.
  const [draft, setDraft] = useState<Record<string, string>>({
    admin: "",
    scanner_pin: "",
    date_override: "",
    delete_confirm: "",
    qr_checker: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Reset whenever lock state changes
  }, [unlocked]);

  const submit = async () => {
    const cleaned: Record<string, string> = {};
    for (const k of Object.keys(draft)) {
      const v = draft[k]?.trim();
      if (v && v.length >= 4) cleaned[k] = v;
    }
    if (!Object.keys(cleaned).length) {
      toast.error("Enter at least one new PIN (min 4 digits)");
      return;
    }
    setSaving(true);
    try {
      await update.mutateAsync(cleaned);
      toast.success(`Updated ${Object.keys(cleaned).length} PIN(s)`);
      setDraft({ admin: "", scanner_pin: "", date_override: "", delete_confirm: "", qr_checker: "" });
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">PIN Settings</h1>
        </div>
      </Card>

      <Card className="border-flag-green/40 bg-flag-green/5">
        <CardContent className="p-3 flex gap-2 items-start text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4 mt-0.5 text-flag-green shrink-0" />
          <span>
            For your security, current PINs are stored as one-way hashes and can never be displayed.
            Leave a field blank to keep its current PIN. Fill in only the PINs you want to change.
          </span>
        </CardContent>
      </Card>

      {Object.keys(labels).map((k) => (
        <Card key={k}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display uppercase tracking-wide">{labels[k].title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{labels[k].desc}</p>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="one-time-code"
              name={`ccs-pin-${k}`}
              data-form-type="other"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              placeholder="Leave blank to keep current"
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              className="font-mono tracking-widest"
            />
          </CardContent>
        </Card>
      ))}

      <Button onClick={submit} disabled={saving} className="w-full bg-gradient-primary">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "Saving…" : "Save changed PINs"}
      </Button>
    </div>
  );
}
