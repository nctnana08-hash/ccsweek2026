import { useMemo, useState } from "react";
import { useEvents, useEventDays } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudents } from "@/hooks/useStudents";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";

export default function IpcExport() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState("");
  const { data: days = [] } = useEventDays(eventId || null);
  const { data: students = [] } = useStudents();
  const { data: records = [] } = useAttendance({ event_id: eventId || undefined });
  const [signatories, setSignatories] = useState({ prepared: "", noted: "", approved: "" });

  const grid = useMemo(() => {
    const presence = new Map<string, Set<string>>();
    records.forEach((r) => {
      if (!presence.has(r.student_id)) presence.set(r.student_id, new Set());
      presence.get(r.student_id)!.add(r.day_id);
    });
    return students.filter((s) => s.status === "enrolled").map((s) => ({
      ...s, days: days.map((d) => presence.get(s.student_id)?.has(d.id) ?? false),
    }));
  }, [records, students, days]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <Card className="overflow-hidden border-0 print:hidden">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">IPC Export</h1>
          <Button size="sm" onClick={() => window.print()} className="bg-gradient-primary"><Printer className="h-4 w-4 mr-1.5" />Print</Button>
        </div>
      </Card>

      <Card className="print:hidden">
        <CardContent className="p-4 grid sm:grid-cols-4 gap-2">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Prepared by" value={signatories.prepared} onChange={(e) => setSignatories({ ...signatories, prepared: e.target.value })} />
          <Input placeholder="Noted by" value={signatories.noted} onChange={(e) => setSignatories({ ...signatories, noted: e.target.value })} />
          <Input placeholder="Approved by" value={signatories.approved} onChange={(e) => setSignatories({ ...signatories, approved: e.target.value })} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <div className="bg-gradient-hero text-primary-foreground p-4 flex items-center gap-3">
          <CcsLogo size={48} className="ring-2 ring-white/40" />
          <div>
            <div className="font-display uppercase text-lg tracking-wide">CCS Attendance Report</div>
            <div className="text-xs opacity-90">{events.find((e) => e.id === eventId)?.event_name ?? "Pick an event"}</div>
          </div>
        </div>
        <Bunting />
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-2 text-left">Name</th>
                <th className="px-2 py-2 text-left">Section</th>
                {days.map((d) => <th key={d.id} className="px-1 py-2 text-center w-10">{d.day_label}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-2 py-1.5">{s.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{s.section}</td>
                  {s.days.map((p, i) => (
                    <td key={i} className="px-1 py-1.5 text-center">
                      <span className={`inline-block w-5 h-5 rounded text-white text-[10px] leading-5 font-bold ${p ? "bg-flag-blue" : "bg-flag-red"}`}>{p ? "P" : "A"}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {grid.length === 0 && <tr><td colSpan={2 + days.length} className="p-8 text-center text-muted-foreground">Pick an event to generate the report.</td></tr>}
            </tbody>
          </table>
        </CardContent>
        <div className="grid sm:grid-cols-3 gap-6 p-6 mt-6 text-xs">
          {(["prepared", "noted", "approved"] as const).map((k) => (
            <div key={k} className="text-center">
              <div className="border-b border-foreground pb-1 mb-1 h-10 flex items-end justify-center font-medium">{signatories[k]}</div>
              <div className="text-muted-foreground uppercase tracking-wider">{k} by</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
