import { useEffect, useMemo, useState } from "react";
import { useEvents, useEventDays } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudents } from "@/hooks/useStudents";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTIONS } from "@/lib/constants";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";
import { Users, ScanLine, CalendarDays, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState<string>("");
  const { data: days = [] } = useEventDays(eventId || null);
  const [dayId, setDayId] = useState<string>("");
  const { data: students = [] } = useStudents();
  const { data: records = [] } = useAttendance({ event_id: eventId || undefined });

  useEffect(() => {
    if (!eventId && events[0]) setEventId(events[0].id);
  }, [events, eventId]);
  useEffect(() => { setDayId(""); }, [eventId]);

  const dayRecords = useMemo(
    () => (dayId ? records.filter((r) => r.day_id === dayId) : records),
    [records, dayId],
  );

  const sectionStats = useMemo(() => {
    const enrolledBySec = new Map<string, number>();
    students.filter((s) => s.status === "enrolled").forEach((s) => {
      enrolledBySec.set(s.section, (enrolledBySec.get(s.section) ?? 0) + 1);
    });
    const scannedBySec = new Map<string, Set<string>>();
    dayRecords.forEach((r) => {
      if (!scannedBySec.has(r.section)) scannedBySec.set(r.section, new Set());
      scannedBySec.get(r.section)!.add(r.student_id);
    });
    return SECTIONS.map((sec) => {
      const enrolled = enrolledBySec.get(sec) ?? 0;
      const scanned = scannedBySec.get(sec)?.size ?? 0;
      const pct = enrolled > 0 ? Math.round((scanned / enrolled) * 100) : 0;
      return { section: sec, scanned, enrolled, pct };
    });
  }, [students, dayRecords]);

  const totals = {
    students: students.length,
    enrolled: students.filter((s) => s.status === "enrolled").length,
    eventScans: records.length,
    eventStudents: new Set(records.map((r) => r.student_id)).size,
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
              <div className="text-[10px] uppercase tracking-[0.35em] opacity-80 font-semibold mb-1">College of Computer Studies</div>
              <h1 className="font-display uppercase text-3xl md:text-4xl tracking-wide drop-shadow-md leading-none">CCS Event Attendance</h1>
              <div className="flex items-center gap-2 mt-2.5">
                <span className="h-1 w-8 bg-flag-yellow rounded-full" aria-hidden />
                <p className="text-sm text-primary-foreground/95 font-medium">Student Council · Festive Edition</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Students" value={totals.students} icon={Users} accent="primary" />
        <StatTile label="Enrolled" value={totals.enrolled} icon={Activity} accent="green" />
        <StatTile label="Event scans" value={totals.eventScans} icon={ScanLine} accent="blue" />
        <StatTile label="Unique attendees" value={totals.eventStudents} icon={CalendarDays} accent="yellow" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1">
              <CardTitle className="font-display uppercase tracking-wide text-base">Per-section breakdown</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Filter by event, then optionally by day.</p>
            </div>
            <div className="flex gap-2">
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={dayId || "all"} onValueChange={(v) => setDayId(v === "all" ? "" : v)}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="All days" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All days</SelectItem>
                  {days.map((d) => <SelectItem key={d.id} value={d.id}>{d.day_label} · {d.date}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {sectionStats.filter(s => s.enrolled > 0).map((s) => (
              <div key={s.section} className="px-3 md:px-4 py-3 md:py-2.5 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                <div className="font-medium text-sm md:flex-1 md:truncate truncate">{s.section}</div>
                <div className="flex items-center gap-3 flex-1 md:flex-initial md:w-auto">
                  <div className="flex-1 md:flex-initial md:w-32 h-2 bg-muted rounded-full overflow-hidden order-2 md:order-none">
                    <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, s.pct)}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums order-1 md:order-none md:w-24 md:text-right text-right">{s.scanned} / {s.enrolled}</div>
                  <div className="text-sm font-semibold tabular-nums order-3 md:order-none md:w-12 md:text-right text-right">{s.pct}%</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, accent }: { label: string; value: number; icon: any; accent: "primary" | "green" | "blue" | "yellow" }) {
  const bg = {
    primary: "from-primary to-primary-glow",
    green: "from-flag-green to-flag-teal",
    blue: "from-flag-blue to-flag-teal",
    yellow: "from-flag-yellow to-primary",
  }[accent];
  return (
    <Card className="overflow-hidden border-0 shadow-card hover:shadow-festive transition-shadow">
      <CardContent className={`relative p-4 bg-gradient-to-br ${bg} text-white overflow-hidden`}>
        <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/15 blur-xl" aria-hidden />
        <div className="absolute -left-2 -bottom-6 w-16 h-16 rounded-full bg-black/10 blur-lg" aria-hidden />
        <Icon className="relative h-5 w-5 mb-2 opacity-90" />
        <div className="relative text-3xl font-display tabular-nums drop-shadow">{value}</div>
        <div className="relative text-[10px] uppercase tracking-[0.2em] opacity-90 font-semibold mt-0.5">{label}</div>
      </CardContent>
    </Card>
  );
}
