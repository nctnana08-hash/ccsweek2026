import { useEffect, useMemo, useRef, useState } from "react";
import { useEvents, useEventDays, useScanSlots } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useActiveContext } from "@/hooks/useSettings";
import { useScanner } from "@/stores/scanner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Lock } from "lucide-react";
import { CcsLogo } from "@/components/CcsLogo";
import { Bunting } from "@/components/Bunting";
import { PinDialog } from "@/components/PinDialog";

export default function OfficerView() {
  const { data: ctx } = useActiveContext();
  const { data: events = [] } = useEvents();
  const { data: days = [] } = useEventDays(ctx?.event_id ?? null);
  const { data: slots = [] } = useScanSlots(ctx?.day_id ?? null);
  const { sessionToken, unlock } = useScanner();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const handleScannerUnlock = (token?: string) => {
    if (token) {
      unlock(token, 3600); // 1 hour session
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="ccs-pennants animate-sway -mx-4 md:-mx-6" aria-hidden />
      
      <Card className="overflow-hidden border-0 shadow-festive ccs-festive-card">
        <div className="relative bg-gradient-hero text-primary-foreground p-6 md:p-8 overflow-hidden">
          <div className="absolute inset-0 ccs-sunburst opacity-50" aria-hidden />
          <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-flag-yellow/25 blur-3xl" aria-hidden />
          <div className="absolute -left-8 -bottom-16 w-48 h-48 rounded-full bg-flag-red/25 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-5">
            <CcsLogo size={76} className="ring-4 ring-white/60 shadow-2xl animate-float" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.35em] opacity-80 font-semibold mb-1">Officer View</div>
              <h1 className="font-display uppercase text-3xl md:text-4xl tracking-wide drop-shadow-md leading-none">Live Scanning</h1>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="h-1 w-8 bg-flag-yellow rounded-full" aria-hidden />
                <p className="text-sm text-primary-foreground/95 font-medium">Read-Only Monitor</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Scanner Control */}
      <Card className="border-0 shadow-card">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="font-display uppercase tracking-wide text-sm mb-1">Scanner Status</h3>
              <p className="text-xs text-muted-foreground mb-3">
                {sessionToken ? "Scanner is unlocked and ready to scan" : "Scanner is locked. Enter PIN to start scanning."}
              </p>
              <Button
                onClick={() => setPinDialogOpen(true)}
                className="w-full bg-gradient-orange text-white hover:opacity-90 gap-2"
              >
                <Lock className="h-4 w-4" />
                {sessionToken ? "Unlock Again" : "Unlock Scanner & Start"}
              </Button>
            </div>
            {ctx?.event_id && ctx?.day_id && ctx?.slot_id && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Event</div>
                  <div className="font-semibold truncate">{events.find(e => e.id === ctx.event_id)?.event_name}</div>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Day</div>
                  <div className="font-semibold truncate">{days.find(d => d.id === ctx.day_id)?.day_label}</div>
                </div>
                <div className="text-center p-2 bg-muted/50 rounded">
                  <div className="text-muted-foreground">Slot</div>
                  <div className="font-semibold truncate">{slots.find(s => s.id === ctx.slot_id)?.slot_label}</div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {!ctx?.event_id || !ctx?.day_id || !ctx?.slot_id ? (
        <Alert className="border-flag-yellow/50 bg-flag-yellow/10">
          <AlertCircle className="h-4 w-4 text-flag-yellow" />
          <AlertDescription className="text-sm">
            Admin is setting up the scanner. Please wait while they configure the event, day, and slot.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Information Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Officer View:</strong> This is a read-only monitoring interface. Only administrators can change the scanning event, day, or slot. 
          To change what's being scanned, ask an admin.
        </AlertDescription>
      </Alert>

      {/* PIN Dialog for Scanner Unlock */}
      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        scope="scanner_pin"
        title="Unlock Scanner"
        description="Enter the scanner PIN to start scanning."
        onSuccess={handleScannerUnlock}
      />
    </div>
  );
}
