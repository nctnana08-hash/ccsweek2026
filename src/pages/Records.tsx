import { useMemo, useState } from "react";
import { useEvents, useEventDays, useScanSlots } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { Bunting } from "@/components/Bunting";
import { SECTIONS } from "@/lib/constants";
import { formatRecordExportTime, formatRecordTime } from "@/lib/datetime";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export default function Records() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState("");
  const [dayId, setDayId] = useState("");
  const [slotId, setSlotId] = useState("");
  const [section, setSection] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 50;

  const { data: days = [] } = useEventDays(eventId || null);
  const { data: slots = [] } = useScanSlots(dayId || null);
  const { data: records = [], isLoading } = useAttendance({
    event_id: eventId || undefined,
    day_id: dayId || undefined,
    slot_id: slotId || undefined,
    section: section || undefined,
    search: search || undefined,
  });

  const paged = useMemo(() => records.slice(page * PAGE, (page + 1) * PAGE), [records, page]);

  const exportExcel = () => {
    if (!records.length) { toast.error("Nothing to export"); return; }
    const rows = records.map((r) => ({
      "Student ID": r.student_id, Name: r.name, Section: r.section,
      Slot: r.slot_label, "Scanned At": formatRecordExportTime(r.scanned_at),
      Late: r.is_late ? "Yes" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Records");
    XLSX.writeFile(wb, `CCS-records-${Date.now()}.xlsx`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">Records</h1>
          <Badge variant="secondary">{records.length} matching</Badge>
          <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Export</span></Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Select value={eventId || "all"} onValueChange={(v) => { setEventId(v === "all" ? "" : v); setDayId(""); setSlotId(""); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All events</SelectItem>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={dayId || "all"} onValueChange={(v) => { setDayId(v === "all" ? "" : v); setSlotId(""); setPage(0); }} disabled={!eventId}>
          <SelectTrigger><SelectValue placeholder="Day" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All days</SelectItem>{days.map((d) => <SelectItem key={d.id} value={d.id}>{d.day_label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={slotId || "all"} onValueChange={(v) => { setSlotId(v === "all" ? "" : v); setPage(0); }} disabled={!dayId}>
          <SelectTrigger><SelectValue placeholder="Slot" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All slots</SelectItem>{slots.map((s) => <SelectItem key={s.id} value={s.id}>{s.slot_label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={section || "all"} onValueChange={(v) => { setSection(v === "all" ? "" : v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
          <SelectContent><SelectItem value="all">All sections</SelectItem>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Search name / ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Student</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Section</th>
                <th className="px-3 py-2 text-left">Slot</th>
                <th className="px-3 py-2 text-left">Late</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs tabular-nums">{formatRecordTime(r.scanned_at)}</td>
                  <td className="px-3 py-2"><div>{r.name}</div><div className="text-xs text-muted-foreground font-mono">{r.student_id}</div></td>
                  <td className="px-3 py-2 hidden md:table-cell text-xs">{r.section}</td>
                  <td className="px-3 py-2"><Badge variant="outline">{r.slot_label}</Badge></td>
                  <td className="px-3 py-2">{r.is_late && <Badge className="bg-flag-red">Late</Badge>}</td>
                </tr>
              ))}
              {!isLoading && records.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No records match</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {records.length > PAGE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {Math.ceil(records.length / PAGE)}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
            <Button size="sm" variant="outline" disabled={(page + 1) * PAGE >= records.length} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
