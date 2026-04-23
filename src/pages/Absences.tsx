import { useMemo, useState } from "react";
import { useEvents, useEventDays } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudents } from "@/hooks/useStudents";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { Bunting } from "@/components/Bunting";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export default function Absences() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState("");
  const { data: days = [] } = useEventDays(eventId || null);
  const [threshold, setThreshold] = useState(4);
  const { data: records = [] } = useAttendance({ event_id: eventId || undefined });
  const { data: students = [] } = useStudents();

  const rows = useMemo(() => {
    if (!eventId || days.length === 0) return [];
    const presentByStudent = new Map<string, Set<string>>();
    for (const r of records) {
      if (!presentByStudent.has(r.student_id)) presentByStudent.set(r.student_id, new Set());
      presentByStudent.get(r.student_id)!.add(r.day_id);
    }
    return students.filter((s) => s.status === "enrolled").map((s) => {
      const present = presentByStudent.get(s.student_id)?.size ?? 0;
      const absent = days.length - present;
      return { ...s, absent, present };
    }).filter((r) => r.absent >= threshold).sort((a, b) => b.absent - a.absent);
  }, [records, students, days, threshold, eventId]);

  const exportExcel = () => {
    if (!rows.length) { toast.error("Nothing to export"); return; }
    const data = rows.map((r) => ({ "Student ID": r.student_id, Name: r.name, Section: r.section, Days: days.length, Present: r.present, Absent: r.absent }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absences");
    XLSX.writeFile(wb, `CCS-absences-${Date.now()}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">Absences</h1>
          <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Export</span></Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Select value={eventId} onValueChange={setEventId}>
          <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Min absences:</span>
          <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(parseInt(e.target.value) || 1)} />
        </div>
        <Badge variant="secondary" className="self-center">{rows.length} students</Badge>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Section</th>
                <th className="px-3 py-2 text-left">Present</th>
                <th className="px-3 py-2 text-left">Absent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2"><div>{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.student_id}</div><div className="text-xs text-muted-foreground md:hidden">{r.section}</div></td>
                  <td className="px-3 py-2 hidden md:table-cell text-xs">{r.section}</td>
                  <td className="px-3 py-2 tabular-nums">{r.present} / {days.length}</td>
                  <td className="px-3 py-2"><Badge className={r.absent >= 8 ? "bg-flag-red" : "bg-muted-foreground"}>{r.absent}</Badge></td>
                </tr>
              ))}
              {(!eventId || rows.length === 0) && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{!eventId ? "Pick an event to see absences." : "No students meet the threshold."}</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
