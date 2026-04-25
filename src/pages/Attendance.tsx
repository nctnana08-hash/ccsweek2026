import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useEvents, useEventDays, useScanSlots } from "@/hooks/useEvents";
import { useStudents } from "@/hooks/useStudents";
import { useActiveContext, useUpdateActiveContext } from "@/hooks/useSettings";
import { useRealtimeAttendance, useRecordScan } from "@/hooks/useAttendance";
import { useAdmin } from "@/stores/admin";
import { useScanner } from "@/stores/scanner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Camera, X, Wifi, WifiOff, Hand, ScanLine, AlertCircle, Lock, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { parseQrPayload } from "@/lib/qr";
import { queueScan, flushQueue, pendingCount } from "@/lib/offline";
import { CcsLogo } from "@/components/CcsLogo";
import { PinDialog } from "@/components/PinDialog";
import { api } from "@/lib/api";


type Feedback = { kind: "in" | "out" | "dup" | "unknown" | "ok"; text: string } | null;

const beep = (freq: number, ms = 120) => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = "sine";
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + ms / 1000);
  } catch {}
};

export default function Attendance() {
  const { unlocked } = useAdmin();
  const { sessionToken, locked, expiresAt, isExpired, unlock, lock, endSession, hydrate } = useScanner();
  const { data: events = [] } = useEvents();
  const { data: ctx } = useActiveContext();
  const updateCtx = useUpdateActiveContext();
  // Draft context (admin edits locally, then explicitly saves to all devices)
  const [draftCtx, setDraftCtx] = useState<{ event_id: string | null; day_id: string | null; slot_id: string | null }>({
    event_id: null, day_id: null, slot_id: null,
  });
  // Sync draft from server context whenever it changes (e.g. on first load or from another device)
  useEffect(() => {
    if (ctx) setDraftCtx({ event_id: ctx.event_id, day_id: ctx.day_id, slot_id: ctx.slot_id });
  }, [ctx?.event_id, ctx?.day_id, ctx?.slot_id]);
  const { data: days = [] } = useEventDays(draftCtx.event_id ?? ctx?.event_id ?? null);
  const { data: slots = [] } = useScanSlots(draftCtx.day_id ?? ctx?.day_id ?? null);
  const { data: students = [] } = useStudents();
  
  const recordScan = useRecordScan();
  useRealtimeAttendance();

  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [counter, setCounter] = useState(0);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [scannerExpireTimer, setScannerExpireTimer] = useState<NodeJS.Timeout | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(0);
  const containerId = "ccs-qr-reader";

  // Hydrate scanner session on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Check if scanner session is expired
  useEffect(() => {
    if (scanning && isExpired()) {
      stopScanner();
      toast.error("Scanner session expired");
    }
  }, [scanning, isExpired]);

  // Timer for scanner expiration
  useEffect(() => {
    if (!sessionToken || !expiresAt || !scanning) {
      if (scannerExpireTimer) clearInterval(scannerExpireTimer);
      return;
    }
    
    const timer = setInterval(() => {
      const timeLeft = expiresAt - Date.now();
      if (timeLeft <= 0) {
        stopScanner();
        lock();
        toast.error("Scanner session locked - PIN required to unlock");
      }
    }, 1000);
    
    setScannerExpireTimer(timer);
    return () => clearInterval(timer);
  }, [sessionToken, expiresAt, scanning, lock]);

  const activeSlot = useMemo(() => slots.find((s) => s.id === ctx?.slot_id), [slots, ctx]);
  const activeEvent = useMemo(() => events.find((e) => e.id === ctx?.event_id), [events, ctx]);
  const activeDay = useMemo(() => days.find((d) => d.id === ctx?.day_id), [days, ctx]);

  // Online/offline + sync
  useEffect(() => {
    const update = async () => { setOnline(navigator.onLine); setPending(await pendingCount()); };
    const handleOnline = async () => {
      setOnline(true);
      const n = await flushQueue();
      if (n > 0) toast.success(`Synced ${n} offline scan${n === 1 ? "" : "s"}`);
      setPending(await pendingCount());
    };
    update();
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", () => setOnline(false));
    const i = setInterval(update, 5000);
    return () => { window.removeEventListener("online", handleOnline); clearInterval(i); };
  }, []);

  // Stop scanner on unmount
  useEffect(() => () => { scannerRef.current?.stop().catch(() => {}); }, []);

  const handleResult = async (raw: string) => {
    const now = Date.now();
    if (now - cooldownRef.current < 2000) return;
    cooldownRef.current = now;

    if (!ctx?.event_id || !ctx?.day_id || !ctx?.slot_id || !activeSlot || !activeDay) {
      setFeedback({ kind: "unknown", text: "Pick Event · Day · Slot first" });
      beep(220, 200); return;
    }

    const payload = parseQrPayload(raw);
    if (!payload) {
      setFeedback({ kind: "unknown", text: "Invalid QR code" });
      beep(220); return;
    }

    // Local roster check (also re-validated server-side)
    const student = students.find((s) => s.student_id === payload.student_id);
    if (!student) {
      setFeedback({ kind: "unknown", text: `Unknown: ${payload.student_id}` });
      beep(220); return;
    }
    if (student.status !== "enrolled") {
      setFeedback({ kind: "unknown", text: `${student.name} is ${student.status}` });
      beep(220); return;
    }

    const scanInput = {
      student_id: student.student_id,
      event_id: ctx.event_id,
      day_id: ctx.day_id,
      slot_id: activeSlot.id,
      scanned_at: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      await queueScan({ ...scanInput, local_id: crypto.randomUUID() });
      setPending(await pendingCount());
      setFeedback({ kind: "ok", text: unlocked ? `${student.name} (queued offline)` : "✓ Recorded (offline)" });
      beep(880); setCounter((c) => c + 1); return;
    }

    try {
      const res = await recordScan.mutateAsync(scanInput);
      if (res.duplicate) {
        // If it's an "out" scan and already recorded, mark as duplicate and don't record
        if (activeSlot.slot_type === "out") {
          setFeedback({ kind: "dup", text: unlocked ? `${student.name} · cannot re-scan out` : "✓ Already checked out" });
          beep(440); return;
        }
        setFeedback({ kind: "dup", text: unlocked ? `${student.name} · already recorded` : "✓ Already recorded" });
        beep(440); return;
      }
      const kind = activeSlot.slot_type === "out" ? "out" : "in";
      setFeedback({
        kind,
        text: unlocked ? `${student.name} · ${activeSlot.slot_label}` : "✓ Recorded",
      });
      beep(kind === "in" ? 880 : 660);
      setCounter((c) => c + 1);
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("unknown_student")) {
        setFeedback({ kind: "unknown", text: "Unknown student" }); beep(220);
      } else {
        setFeedback({ kind: "unknown", text: "Save failed — queued offline" });
        await queueScan({ ...scanInput, local_id: crypto.randomUUID() });
        setPending(await pendingCount()); beep(220);
      }
    }
  };

  const startScanner = async () => {
    // If already has valid session, start immediately
    if (sessionToken && !isExpired() && !locked) {
      await doStartScanner();
      return;
    }
    // If locked or expired, show PIN dialog
    setPinDialogOpen(true);
  };

  const doStartScanner = async () => {
    setScanning(true); 
    setCounter(0);
    setTimeout(async () => {
      try {
        const q = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = q;
        await q.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (text) => { handleResult(text); }, () => {});
      } catch (e) {
        toast.error("Camera permission denied");
        setScanning(false);
      }
    }, 100);
  };

  const handlePinSuccess = async (token?: string) => {
    if (token) {
      unlock(token);
    }
    await doStartScanner();
  };

  const stopScanner = async () => {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null; setScanning(false); setFeedback(null);
  };

  const setEvent = (id: string) => {
    if (!unlocked) { toast.error("Only admins can change the scanner context"); return; }
    setDraftCtx({ event_id: id, day_id: null, slot_id: null });
  };
  const setDay = (id: string) => {
    if (!unlocked) { toast.error("Only admins can change the scanner context"); return; }
    setDraftCtx((d) => ({ ...d, day_id: id, slot_id: null }));
  };
  const setSlot = (id: string) => {
    if (!unlocked) { toast.error("Only admins can change the scanner context"); return; }
    setDraftCtx((d) => ({ ...d, slot_id: id }));
  };

  const draftDirty =
    draftCtx.event_id !== (ctx?.event_id ?? null) ||
    draftCtx.day_id !== (ctx?.day_id ?? null) ||
    draftCtx.slot_id !== (ctx?.slot_id ?? null);

  const saveContext = async () => {
    if (!unlocked) { toast.error("Admin only"); return; }
    if (!draftCtx.event_id || !draftCtx.day_id || !draftCtx.slot_id) {
      toast.error("Pick Event, Day and Slot first");
      return;
    }
    try {
      await updateCtx.mutateAsync(draftCtx);
      toast.success("Saved — synced to all devices");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to sync. Re-enter admin PIN and try again.");
    }
  };

  const fbColor = feedback?.kind === "in" ? "bg-scan-in" : feedback?.kind === "out" ? "bg-scan-out"
    : feedback?.kind === "dup" ? "bg-scan-dup" : feedback?.kind === "unknown" ? "bg-scan-unknown" : "bg-scan-in";

  return (
    <div className="p-3 md:p-6 space-y-3 max-w-4xl mx-auto">
      <div className="ccs-pennants animate-sway -mx-3 md:-mx-6" aria-hidden />
      <Card className="overflow-hidden border-0 shadow-festive ccs-festive-card">
        <div className="relative bg-gradient-hero text-primary-foreground p-5 flex items-center gap-3 overflow-hidden">
          <div className="absolute inset-0 ccs-sunburst opacity-50" aria-hidden />
          <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-flag-yellow/25 blur-2xl" aria-hidden />
          <div className="absolute -left-6 -bottom-10 w-28 h-28 rounded-full bg-flag-red/20 blur-2xl" aria-hidden />
          <CcsLogo size={52} className="relative ring-2 ring-white/60 animate-float shadow-xl" />
          <div className="relative flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-semibold">Officer Console</div>
            <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide drop-shadow">Attendance Scanner</h1>
            <p className="text-xs opacity-90 truncate mt-0.5">
              {activeEvent?.event_name ?? "—"} <span className="opacity-60">›</span> {activeDay?.day_label ?? "—"} <span className="opacity-60">›</span> {activeSlot?.slot_label ?? "—"}
            </p>
          </div>
          <div className="relative flex items-center gap-1.5">
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-flag-yellow" />}
            {pending > 0 && <Badge variant="secondary" className="text-xs">{pending} queued</Badge>}
          </div>
        </div>
      </Card>

      <Card className="p-3 space-y-2 ccs-festive-card border-0">
        <div className="grid grid-cols-3 gap-2">
          <Select value={draftCtx.event_id ?? ""} onValueChange={setEvent} disabled={!unlocked}>
            <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={draftCtx.day_id ?? ""} onValueChange={setDay} disabled={!unlocked || !draftCtx.event_id}>
            <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
            <SelectContent>{days.map((d) => <SelectItem key={d.id} value={d.id}>{d.day_label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={draftCtx.slot_id ?? ""} onValueChange={setSlot} disabled={!unlocked || !draftCtx.day_id}>
            <SelectTrigger><SelectValue placeholder="Slot" /></SelectTrigger>
            <SelectContent>{slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.slot_label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {unlocked && (
          <div className="flex items-center gap-2 pt-1">
            <div className="flex-1 text-xs text-muted-foreground">
              {draftDirty
                ? "Unsaved changes — click Save to sync to all devices."
                : "All devices are in sync with the current selection."}
            </div>
            <Button
              size="sm"
              onClick={saveContext}
              disabled={!draftDirty || updateCtx.isPending || !draftCtx.event_id || !draftCtx.day_id || !draftCtx.slot_id}
              className="bg-gradient-primary text-white shadow-festive"
            >
              {updateCtx.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save & Sync
            </Button>
          </div>
        )}
      </Card>

      {!scanning ? (
        <Card className="relative overflow-hidden border-0 ccs-festive-card">
          <div className="absolute inset-0 ccs-stripes" aria-hidden />
          <div className="relative p-10 flex flex-col items-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-primary blur-2xl opacity-40 animate-pulse" aria-hidden />
              <div className="relative h-24 w-24 rounded-full bg-gradient-primary flex items-center justify-center shadow-festive ring-4 ring-white">
                <ScanLine className="h-12 w-12 text-white" />
              </div>
            </div>
            <div className="ccs-divider w-48" aria-hidden />
            <p className="text-center text-sm text-muted-foreground max-w-sm">
              {!ctx?.slot_id ? "Pick an Event · Day · Slot above to begin." : "Tap Start to open the camera and begin scanning."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Button 
                size="lg" 
                disabled={!ctx?.slot_id} 
                onClick={startScanner} 
                className="bg-gradient-primary shadow-festive hover:scale-105 transition-transform"
              >
                {locked ? <Lock className="h-5 w-5 mr-2" /> : <Camera className="h-5 w-5 mr-2" />}
                {locked ? "Unlock Scanner" : "Start scanning"}
              </Button>
              {unlocked && (
                <Button size="lg" variant="outline" disabled={!ctx?.slot_id} onClick={() => setManualOpen(true)}>
                  <Hand className="h-5 w-5 mr-2" />Manual entry
                </Button>
              )}
            </div>
            {sessionToken && expiresAt && !isExpired() && (
              <div className="flex items-center gap-2 text-xs text-green-700 mt-2 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
                <Lock className="h-3.5 w-3.5" />
                Scanner active for {Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000))} min
              </div>
            )}
            {!unlocked && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 px-3 py-1.5 rounded-full bg-muted/60">
                <AlertCircle className="h-3.5 w-3.5" />
                Officer view: scans show "✓ Recorded" without student names
              </div>
            )}
          </div>
        </Card>
      ) : (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="bg-gradient-hero text-primary-foreground p-3 flex items-center gap-2">
            <Button size="icon" variant="ghost" className="text-white hover:bg-white/20" onClick={stopScanner}>
              <X className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0 text-sm">
              <div className="font-display uppercase tracking-wide truncate">{activeSlot?.slot_label}</div>
              <div className="text-xs opacity-90 truncate">{activeEvent?.event_name} · {activeDay?.day_label}</div>
            </div>
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">{counter} scanned</Badge>
          </div>
          <div className="flex-1 relative bg-black">
            <div id={containerId} className="w-full h-full [&_video]:object-cover [&_video]:!w-full [&_video]:!h-full" />
          </div>
          {feedback && (
            <div className={`${fbColor} text-white px-4 py-3 text-center font-semibold animate-fade-in`}>
              {feedback.text}
            </div>
          )}
          <div className="bg-black p-3 flex gap-2">
            <Select value={ctx?.slot_id ?? ""} onValueChange={setSlot}>
              <SelectTrigger className="bg-white/10 text-white border-white/20"><SelectValue /></SelectTrigger>
              <SelectContent>{slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.slot_label}</SelectItem>)}</SelectContent>
            </Select>
            {unlocked && (
              <Button variant="secondary" onClick={() => setManualOpen(true)}><Hand className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">Manual Entry</DialogTitle></DialogHeader>
          <Command>
            <CommandInput placeholder="Search name or ID…" value={manualSearch} onValueChange={setManualSearch} />
            <CommandList>
              <CommandEmpty>No students found</CommandEmpty>
              <CommandGroup>
                {students.filter((s) => s.status === "enrolled").slice(0, 50).map((s) => (
                  <CommandItem key={s.id} value={`${s.name} ${s.student_id}`} onSelect={async () => {
                    setManualOpen(false);
                    cooldownRef.current = 0;
                    await handleResult(`CCS_QR_V1::${btoa(JSON.stringify({ system: "ccs_system", type: "student", profile_id: s.id, student_id: s.student_id, last_name: s.name.split(" ").pop(), section: s.section }))}`);
                  }}>
                    <span className="font-medium">{s.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{s.student_id} · {s.section}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <PinDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        scope="scanner_pin"
        title="Unlock Scanner"
        description="Enter the PIN to activate the scanner for 1 hour."
        onSuccess={handlePinSuccess}
      />
    </div>
  );
}
