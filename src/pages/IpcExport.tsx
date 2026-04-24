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
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto print:p-0 print:space-y-0 print:max-w-none">
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

      <Card className="overflow-hidden print:shadow-none print:border-none">
        <div className="bg-gradient-orange text-white p-4 flex items-center gap-3 print:p-6">
          <CcsLogo size={48} className="ring-2 ring-white/40" />
          <div>
            <div className="font-display uppercase text-lg tracking-wide">CCS Attendance Report</div>
            <div className="text-xs opacity-90">{events.find((e) => e.id === eventId)?.event_name ?? "Pick an event"}</div>
          </div>
        </div>
        <Bunting />
        <CardContent className="p-0 overflow-x-auto print:overflow-visible">
          <table className="w-full text-xs print:text-[10px]">
            <thead className="bg-muted/50 print:bg-orange-100">
              <tr>
                <th className="px-2 py-2 text-left print:px-3 print:py-2">Name</th>
                <th className="px-2 py-2 text-left print:px-3 print:py-2">Section</th>
                {days.map((d) => <th key={d.id} className="px-1 py-2 text-center w-10 print:px-2">{d.day_label}</th>)}
              </tr>
            </thead>
            <tbody>
              {grid.map((s) => (
                <tr key={s.id} className="border-t print:border-orange-200">
                  <td className="px-2 py-1.5 print:px-3">{s.name}</td>
                  <td className="px-2 py-1.5 text-muted-foreground print:px-3 print:text-gray-600">{s.section}</td>
                  {s.days.map((p, i) => (
                    <td key={i} className="px-1 py-1.5 text-center print:px-2">
                      <span className={`inline-block w-5 h-5 rounded text-white text-[10px] leading-5 font-bold print:w-6 print:h-6 print:text-[11px] print:leading-6 ${p ? "bg-flag-blue print:bg-blue-600" : "bg-flag-red print:bg-red-600"}`}>{p ? "P" : "A"}</span>
                    </td>
                  ))}
                </tr>
              ))}
              {grid.length === 0 && <tr><td colSpan={2 + days.length} className="p-8 text-center text-muted-foreground">Pick an event to generate the report.</td></tr>}
            </tbody>
          </table>
        </CardContent>
        <div className="grid sm:grid-cols-3 gap-6 p-6 mt-6 text-xs print:p-8 print:gap-12 print:mt-12 print:text-[11px]">
          {(["prepared", "noted", "approved"] as const).map((k) => (
            <div key={k} className="text-center">
              <div className="border-b border-foreground pb-1 mb-1 h-10 flex items-end justify-center font-medium print:h-12 print:pb-2 print:border-orange-800">{signatories[k]}</div>
              <div className="text-muted-foreground uppercase tracking-wider print:text-gray-700">{k} by</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
