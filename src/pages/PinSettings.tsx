import { useEffect, useState } from "react";
import { usePins, useUpdatePins } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bunting } from "@/components/Bunting";
import { Save, KeyRound } from "lucide-react";
import { toast } from "sonner";

const labels: Record<string, { title: string; desc: string }> = {
  admin: { title: "Admin Unlock", desc: "Unlocks Dashboard, Students, Events, Records, Absences, IPC, manual entry." },
  date_override: { title: "Date Override", desc: "Required to record attendance outside the active event's day range." },
  delete_confirm: { title: "Delete Confirmation", desc: "Required when deleting students, attendance records, events, days, or slots." },
  qr_checker: { title: "QR Checker Access", desc: "Standalone utility to verify a roster against scans for a slot." },
};

export default function PinSettings() {
  const { data: pins } = usePins();
  const update = useUpdatePins();
  const [draft, setDraft] = useState<any>(null);

  useEffect(() => { if (pins) setDraft({ ...pins }); }, [pins]);
  if (!draft) return null;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-2xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <KeyRound className="h-6 w-6 text-primary" />
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">PIN Settings</h1>
        </div>
      </Card>

      {Object.keys(labels).map((k) => (
        <Card key={k}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-display uppercase tracking-wide">{labels[k].title}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">{labels[k].desc}</p>
            <Input type="text" inputMode="numeric" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} className="font-mono tracking-widest" />
          </CardContent>
        </Card>
      ))}

      <Button onClick={async () => { await update.mutateAsync(draft); toast.success("PINs saved"); }} className="w-full bg-gradient-primary"><Save className="h-4 w-4 mr-2" />Save PINs</Button>
    </div>
  );
}
