import { useEffect, useMemo, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useEvents, useEventDays, useScanSlots } from "@/hooks/useEvents";
import { useStudents } from "@/hooks/useStudents";
import { useActiveContext, useUpdateActiveContext, usePins } from "@/hooks/useSettings";
import { useRealtimeAttendance, useRecordScan } from "@/hooks/useAttendance";
import { useAdmin } from "@/stores/admin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Camera, X, Wifi, WifiOff, Hand, ScanLine, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parseQrPayload } from "@/lib/qr";
import { supabase } from "@/integrations/supabase/client";
import { queueScan, flushQueue, pendingCount } from "@/lib/offline";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";

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
  const { data: events = [] } = useEvents();
  const { data: ctx } = useActiveContext();
  const updateCtx = useUpdateActiveContext();
  const { data: days = [] } = useEventDays(ctx?.event_id ?? null);
  const { data: slots = [] } = useScanSlots(ctx?.day_id ?? null);
  const { data: students = [] } = useStudents();
  const { data: pins } = usePins();
  const recordScan = useRecordScan();
  useRealtimeAttendance();

  const [scanning, setScanning] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [counter, setCounter] = useState(0);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(0);
  const containerId = "ccs-qr-reader";

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

    const student = students.find((s) => s.id === payload.profile_id) || students.find((s) => s.student_id === payload.student_id);
    if (!student) {
      setFeedback({ kind: "unknown", text: `Unknown: ${payload.student_id}` });
      beep(220); return;
    }
    if (student.status !== "enrolled") {
      setFeedback({ kind: "unknown", text: `${student.name} is ${student.status}` });
      beep(220); return;
    }

    // Duplicate check
    const { data: existing } = await supabase
      .from("attendance_records").select("scanned_at").eq("profile_id", student.id).eq("slot_id", activeSlot.id).maybeSingle();
    if (existing) {
      setFeedback({ kind: "dup", text: `${unlocked ? student.name : "✓ Already recorded"} · ${new Date((existing as any).scanned_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` });
      beep(440); return;
    }

    // IN→OUT pairing warning
    if (activeSlot.slot_type === "out") {
      const { data: inMatches } = await supabase
        .from("attendance_records").select("id").eq("profile_id", student.id).eq("day_id", activeDay.id).limit(20);
      const slotsToday = slots.filter((s) => s.slot_type === "in").map((s) => s.id);
      const hasIn = (inMatches as any[] | null)?.some((r) => slotsToday.includes(r.id));
      if (!hasIn && slotsToday.length > 0) toast.warning(`${student.name}: no IN scan today — saving OUT anyway`);
    }

    // Late check
    let isLate = false;
    if (activeSlot.late_cutoff_time) {
      const [h, m] = activeSlot.late_cutoff_time.split(":").map(Number);
      const cutoff = new Date(); cutoff.setHours(h, m, 0, 0);
      isLate = Date.now() > cutoff.getTime();
    }

    const rec = {
      profile_id: student.id,
      student_id: student.student_id,
      name: student.name,
      section: student.section,
      event_id: ctx.event_id,
      day_id: ctx.day_id,
      slot_id: activeSlot.id,
      slot_label: activeSlot.slot_label,
      is_late: isLate,
      scanned_at: new Date().toISOString(),
    };

    if (!navigator.onLine) {
      await queueScan({ ...rec, local_id: crypto.randomUUID() });
      setPending(await pendingCount());
      setFeedback({ kind: "ok", text: unlocked ? `${student.name} (queued offline)` : "✓ Recorded (offline)" });
      beep(880); setCounter((c) => c + 1); return;
    }

    try {
      await recordScan.mutateAsync(rec);
      const kind = activeSlot.slot_type === "out" ? "out" : "in";
      setFeedback({ kind, text: unlocked ? `${student.name} · ${activeSlot.slot_label}` : "✓ Recorded" });
      beep(kind === "in" ? 880 : 660);
      setCounter((c) => c + 1);
    } catch (e: any) {
      if (e?.code === "23505") {
        setFeedback({ kind: "dup", text: "Already recorded" }); beep(440);
      } else {
        setFeedback({ kind: "unknown", text: "Save failed — queued offline" });
        await queueScan({ ...rec, local_id: crypto.randomUUID() });
        setPending(await pendingCount()); beep(220);
      }
    }
  };

  const startScanner = async () => {
    setScanning(true); setCounter(0);
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
  const stopScanner = async () => {
    try { await scannerRef.current?.stop(); await scannerRef.current?.clear(); } catch {}
    scannerRef.current = null; setScanning(false); setFeedback(null);
  };

  const setEvent = (id: string) => updateCtx.mutate({ event_id: id, day_id: null, slot_id: null });
  const setDay = (id: string) => updateCtx.mutate({ event_id: ctx?.event_id ?? null, day_id: id, slot_id: null });
  const setSlot = (id: string) => updateCtx.mutate({ event_id: ctx?.event_id ?? null, day_id: ctx?.day_id ?? null, slot_id: id });

  const fbColor = feedback?.kind === "in" ? "bg-scan-in" : feedback?.kind === "out" ? "bg-scan-out"
    : feedback?.kind === "dup" ? "bg-scan-dup" : feedback?.kind === "unknown" ? "bg-scan-unknown" : "bg-scan-in";

  return (
    <div className="p-3 md:p-6 space-y-3 max-w-4xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="bg-gradient-hero text-primary-foreground p-4 flex items-center gap-3">
          <CcsLogo size={48} className="ring-2 ring-white/40" />
          <div className="flex-1 min-w-0">
            <h1 className="font-display uppercase text-lg md:text-xl tracking-wide">Attendance Scanner</h1>
            <p className="text-xs opacity-90 truncate">
              {activeEvent?.event_name ?? "—"} › {activeDay?.day_label ?? "—"} › {activeSlot?.slot_label ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4 text-flag-yellow" />}
            {pending > 0 && <Badge variant="secondary" className="text-xs">{pending} queued</Badge>}
          </div>
        </div>
      </Card>

      <Card className="p-3 grid grid-cols-3 gap-2">
        <Select value={ctx?.event_id ?? ""} onValueChange={setEvent}>
          <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ctx?.day_id ?? ""} onValueChange={setDay} disabled={!ctx?.event_id}>
          <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
          <SelectContent>{days.map((d) => <SelectItem key={d.id} value={d.id}>{d.day_label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={ctx?.slot_id ?? ""} onValueChange={setSlot} disabled={!ctx?.day_id}>
          <SelectTrigger><SelectValue placeholder="Slot" /></SelectTrigger>
          <SelectContent>{slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.slot_label}</SelectItem>)}</SelectContent>
        </Select>
      </Card>

      {!scanning ? (
        <Card className="p-8 flex flex-col items-center gap-4 ccs-circuit-bg">
          <ScanLine className="h-16 w-16 text-primary" />
          <p className="text-center text-sm text-muted-foreground max-w-sm">
            {!ctx?.slot_id ? "Pick an Event · Day · Slot above to begin." : "Tap Start to open the camera and begin scanning."}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button size="lg" disabled={!ctx?.slot_id} onClick={startScanner} className="bg-gradient-primary shadow-festive">
              <Camera className="h-5 w-5 mr-2" />Start scanning
            </Button>
            {unlocked && (
              <Button size="lg" variant="outline" disabled={!ctx?.slot_id} onClick={() => setManualOpen(true)}>
                <Hand className="h-5 w-5 mr-2" />Manual entry
              </Button>
            )}
          </div>
          {!unlocked && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <AlertCircle className="h-3.5 w-3.5" />
              Officer view: scans show "✓ Recorded" without student names
            </div>
          )}
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
    </div>
  );
}
