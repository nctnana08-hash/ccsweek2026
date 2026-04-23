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
      <Card className="overflow-hidden border-0 shadow-festive">
        <Bunting />
        <div className="bg-gradient-hero text-primary-foreground p-5 md:p-7 flex items-center gap-4">
          <CcsLogo size={64} className="ring-2 ring-white/40" />
          <div>
            <h1 className="font-display uppercase text-2xl md:text-3xl tracking-wide">CCS Event Attendance</h1>
            <p className="text-sm text-primary-foreground/90">College of Computer Studies · Student Council</p>
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
            {sectionStats.map((s) => (
              <div key={s.section} className="px-4 py-2.5 flex items-center gap-3">
                <div className="font-medium text-sm flex-1 truncate">{s.section}</div>
                <div className="text-xs text-muted-foreground tabular-nums w-24 text-right">{s.scanned} / {s.enrolled}</div>
                <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(100, s.pct)}%` }} />
                </div>
                <div className="text-sm font-semibold tabular-nums w-12 text-right">{s.pct}%</div>
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
    <Card className="overflow-hidden">
      <CardContent className={`p-4 bg-gradient-to-br ${bg} text-white`}>
        <Icon className="h-5 w-5 mb-2 opacity-90" />
        <div className="text-2xl font-display tabular-nums">{value}</div>
        <div className="text-xs uppercase tracking-wider opacity-90">{label}</div>
      </CardContent>
    </Card>
  );
}
