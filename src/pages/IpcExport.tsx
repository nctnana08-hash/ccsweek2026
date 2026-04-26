import { useMemo, useState } from "react";
import { useEvents, useEventDays } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudents, useDeleteStudents } from "@/hooks/useStudents";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer, Trash2 } from "lucide-react";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";
import { SECTIONS } from "@/lib/constants";
import { PinDialog } from "@/components/PinDialog";
import { toast } from "sonner";

export default function IpcExport() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const { data: days = [] } = useEventDays(eventId || null);
  const { data: students = [] } = useStudents();
  const { data: records = [] } = useAttendance({ event_id: eventId || undefined });
  const [signatories, setSignatories] = useState({ prepared: "", noted: "", approved: "" });
  const del = useDeleteStudents();
  const [pinOpen, setPinOpen] = useState(false);

  const grid = useMemo(() => {
    // Map: student_id + day_id -> { in: time, out: time }
    const attendanceMap = new Map<string, { in?: string; out?: string }>();
    records.forEach((r) => {
      const key = `${r.student_id}|${r.day_id}`;
      if (!attendanceMap.has(key)) attendanceMap.set(key, {});
      const time = new Date(r.scanned_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      if (r.slot_label.toLowerCase().includes("in")) {
        attendanceMap.get(key)!.in = time;
      } else if (r.slot_label.toLowerCase().includes("out")) {
        attendanceMap.get(key)!.out = time;
      }
    });

    // Group by section (respect section filter)
    const bySection = new Map<string, typeof students>();
    students
      .filter((s) => s.status === "enrolled" && (sectionFilter === "all" || s.section === sectionFilter))
      .forEach((s) => {
        if (!bySection.has(s.section)) bySection.set(s.section, []);
        bySection.get(s.section)!.push(s);
      });

    const result = Array.from(bySection.entries()).map(([section, sectionStudents]) => ({
      section,
      students: sectionStudents.map((s) => ({
        ...s,
        days: days.map((d) => {
          const key = `${s.student_id}|${d.id}`;
          return attendanceMap.get(key) ?? {};
        }),
      })),
    }));

    return result;
  }, [records, students, days, sectionFilter]);

  const confirmDeleteSection = async () => {
    const ids = students
      .filter((s) => sectionFilter === "all" || s.section === sectionFilter)
      .map((s) => s.id);
    if (!ids.length) { toast.info("No students to delete"); return; }
    await del.mutateAsync(ids);
    toast.success(`Deleted ${ids.length} student${ids.length === 1 ? "" : "s"}${sectionFilter === "all" ? "" : ` from ${sectionFilter}`}`);
  };

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
        <CardContent className="p-4 grid sm:grid-cols-5 gap-2">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>{events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Prepared by" value={signatories.prepared} onChange={(e) => setSignatories({ ...signatories, prepared: e.target.value })} />
          <Input placeholder="Noted by" value={signatories.noted} onChange={(e) => setSignatories({ ...signatories, noted: e.target.value })} />
          <Input placeholder="Approved by" value={signatories.approved} onChange={(e) => setSignatories({ ...signatories, approved: e.target.value })} />
        </CardContent>
        <div className="px-4 pb-4 flex justify-end">
          <Button size="sm" variant="destructive" onClick={() => setPinOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete students {sectionFilter !== "all" ? `in ${sectionFilter}` : "(all)"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden print:shadow-none print:border-none print:break-inside-avoid">
        <div className="bg-gradient-orange text-white p-4 flex items-center gap-3 print:p-6">
          <CcsLogo size={48} className="ring-2 ring-white/40" />
          <div>
            <div className="font-display uppercase text-lg tracking-wide text-black">CCS Attendance Report</div>
            <div className="text-xs opacity-90 text-black">{events.find((e) => e.id === eventId)?.event_name ?? "Pick an event"}</div>
          </div>
        </div>
        <Bunting />
        <CardContent className="p-0 overflow-x-auto print:overflow-visible">
          {grid.map((section) => (
            <div key={section.section} className="print:page-break-inside-avoid">
              <div className="bg-orange-100 px-4 py-2 font-semibold text-black border-b border-black print:border-b-2 print:border-black">
                Section: {section.section}
              </div>
              <table className="w-full text-xs print:text-[10px]">
                <thead className="bg-orange-50 print:bg-orange-100">
                  <tr className="border-b border-black print:border-b-2 print:border-black">
                    <th className="px-2 py-2 text-left print:px-3 print:py-2 text-black">Name</th>
                    {days.map((d) => (
                      <th key={d.id} className="px-2 py-2 text-center print:px-2 text-black border-l border-black print:border-l-2">
                        {d.day_label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.students.map((s) => (
                    <tr key={s.id} className="border-b border-black print:border-b print:border-black">
                      <td className="px-2 py-1.5 print:px-3 text-black">{s.name}</td>
                      {s.days.map((day, i) => (
                        <td key={i} className="px-2 py-1.5 text-center text-black border-l border-black print:border-l print:border-black print:px-2">
                          {day.in && day.out ? (
                            <div className="text-[9px] print:text-[8px]">
                              <div>In: {day.in}</div>
                              <div>Out: {day.out}</div>
                            </div>
                          ) : day.in ? (
                            <div className="text-[9px] print:text-[8px]">In: {day.in}</div>
                          ) : day.out ? (
                            <div className="text-[9px] print:text-[8px]">Out: {day.out}</div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {grid.length === 0 && <div className="p-8 text-center text-muted-foreground">Pick an event to generate the report.</div>}
        </CardContent>
        <div className="grid sm:grid-cols-3 gap-6 p-6 mt-6 text-xs print:p-8 print:gap-12 print:mt-12 print:text-[11px]">
          {(["prepared", "noted", "approved"] as const).map((k) => (
            <div key={k} className="text-center">
              <div className="border-b-2 border-black pb-1 mb-1 h-10 flex items-end justify-center font-medium print:h-12 print:pb-2 text-black">{signatories[k]}</div>
              <div className="text-black uppercase tracking-wider print:text-black">{k} by</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
