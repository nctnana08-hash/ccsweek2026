import { useEffect, useMemo, useRef } from "react";
import { useEvents, useEventDays, useScanSlots } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useActiveContext } from "@/hooks/useSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { AlertCircle, Activity, ScanLine } from "lucide-react";
import { CcsLogo } from "@/components/CcsLogo";
import { Bunting } from "@/components/Bunting";

export default function OfficerView() {
  const { data: ctx } = useActiveContext();
  const { data: events = [] } = useEvents();
  const { data: days = [] } = useEventDays(ctx?.event_id ?? null);
  const { data: slots = [] } = useScanSlots(ctx?.day_id ?? null);
  const { data: records = [] } = useAttendance({
    event_id: ctx?.event_id || undefined,
    day_id: ctx?.day_id || undefined,
    slot_id: ctx?.slot_id || undefined,
  });

  const activeEvent = useMemo(() => events.find((e) => e.id === ctx?.event_id), [events, ctx]);
  const activeDay = useMemo(() => days.find((d) => d.id === ctx?.day_id), [days, ctx]);
  const activeSlot = useMemo(() => slots.find((s) => s.id === ctx?.slot_id), [slots, ctx]);

  // Auto-scroll to latest records
  const tableBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tableBodyRef.current) {
      tableBodyRef.current.scrollTop = tableBodyRef.current.scrollHeight;
    }
  }, [records]);

  const recentRecords = useMemo(() => records.slice(-20).reverse(), [records]);

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

      {/* Current Scanner Context */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Current Event</div>
            <div className="font-display text-lg tracking-wide truncate text-center">
              {activeEvent?.event_name ?? "—"}
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-card">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Current Day</div>
            <div className="font-display text-lg tracking-wide truncate text-center">
              {activeDay?.day_label ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-2">
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Current Slot</div>
            <Badge variant="outline" className="text-base py-1 px-3">
              {activeSlot?.slot_label ?? "—"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Alert if nothing is being scanned */}
      {!ctx?.event_id || !ctx?.day_id || !ctx?.slot_id ? (
        <Alert className="border-flag-yellow/50 bg-flag-yellow/10">
          <AlertCircle className="h-4 w-4 text-flag-yellow" />
          <AlertDescription className="text-sm">
            No active scanning context. Admin must select an event, day, and slot to begin.
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Live Attendance Records */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <CardTitle className="font-display uppercase tracking-wide text-base">Live Attendance</CardTitle>
            <Badge className="ml-auto bg-gradient-primary">{records.length} scans</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Latest 20 scans • Read-only view • Auto-updates</p>
        </CardHeader>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
              <ScanLine className="h-8 w-8 opacity-30" />
              <p>No scans yet for this context</p>
            </div>
          ) : (
            <div 
              ref={tableBodyRef}
              className="overflow-x-auto overflow-y-auto max-h-96 divide-y"
            >
              <div className="sticky top-0 bg-muted/50 px-3 py-2 text-xs uppercase tracking-wider font-medium text-muted-foreground grid grid-cols-12 gap-2">
                <div className="col-span-3">Time</div>
                <div className="col-span-5">Student</div>
                <div className="col-span-2">Slot</div>
                <div className="col-span-2">Late</div>
              </div>
              {recentRecords.map((r) => (
                <div 
                  key={r.id} 
                  className="px-3 py-3 hover:bg-muted/30 transition-colors grid grid-cols-12 gap-2 text-sm border-b"
                >
                  <div className="col-span-3 text-xs tabular-nums text-muted-foreground">
                    {format(new Date(r.scanned_at), "HH:mm:ss")}
                  </div>
                  <div className="col-span-5">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{r.student_id}</div>
                  </div>
                  <div className="col-span-2">
                    <Badge variant="outline" className="text-xs">{r.slot_label}</Badge>
                  </div>
                  <div className="col-span-2">
                    {r.is_late && (
                      <Badge className="bg-flag-red text-xs">Late</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <strong>Officer View:</strong> This is a read-only monitoring interface. Only administrators can change the scanning event, day, or slot. 
          To change what's being scanned, ask an admin.
        </AlertDescription>
      </Alert>
    </div>
  );
}
