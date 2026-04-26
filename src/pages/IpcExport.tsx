import { useMemo, useState } from "react";
import { useEvents, useEventDays } from "@/hooks/useEvents";
import { useAttendance } from "@/hooks/useAttendance";
import { useStudents, useDeleteStudents } from "@/hooks/useStudents";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Printer, Trash2 } from "lucide-react";
import { CcsLogo } from "@/components/CcsLogo";
import { SECTIONS } from "@/lib/constants";
import { PinDialog } from "@/components/PinDialog";
import { toast } from "sonner";
import { formatDate } from "@/lib/datetime";

export default function IpcExport() {
  const { data: events = [] } = useEvents();
  const [eventId, setEventId] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const { data: days = [] } = useEventDays(eventId || null);
  const { data: students = [] } = useStudents();
  const { data: records = [] } = useAttendance({ event_id: eventId || undefined });
  const [signatories, setSignatories] = useState({
    prepared: "Event Committee",
    noted: "CCS Secretary",
    approved: "CCS Student Council President",
  });
  const del = useDeleteStudents();
  const [pinOpen, setPinOpen] = useState(false);

  const event = events.find((e) => e.id === eventId);

  const grid = useMemo(() => {
    const attendanceMap = new Map<string, { in?: string; out?: string }>();
    records.forEach((r) => {
      const key = `${r.student_id}|${r.day_id}`;
      if (!attendanceMap.has(key)) attendanceMap.set(key, {});
      const time = new Date(r.scanned_at).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Manila",
      });
      if (r.slot_label.toLowerCase().includes("in")) attendanceMap.get(key)!.in = time;
      else if (r.slot_label.toLowerCase().includes("out")) attendanceMap.get(key)!.out = time;
    });

    const bySection = new Map<string, typeof students>();
    students
      .filter((s) => s.status === "enrolled" && (sectionFilter === "all" || s.section === sectionFilter))
      .forEach((s) => {
        if (!bySection.has(s.section)) bySection.set(s.section, []);
        bySection.get(s.section)!.push(s);
      });

    // Order sections following SECTIONS list
    const orderedKeys = [...bySection.keys()].sort(
      (a, b) => (SECTIONS as readonly string[]).indexOf(a) - (SECTIONS as readonly string[]).indexOf(b),
    );

    return orderedKeys.map((section) => ({
      section,
      students: bySection.get(section)!.map((s) => ({
        ...s,
        days: days.map((d) => attendanceMap.get(`${s.student_id}|${d.id}`) ?? {}),
      })),
    }));
  }, [records, students, days, sectionFilter]);

  // Group sections by program for the summary page
  const sectionsByProgram = useMemo(() => {
    const all = sectionFilter === "all" ? (SECTIONS as readonly string[]) : [sectionFilter];
    const it: string[] = [];
    const cs: string[] = [];
    all.forEach((s) => {
      if (s.startsWith("BSIT")) it.push(s.replace("BSIT ", ""));
      else if (s.startsWith("BSCS")) cs.push(s.replace("BSCS ", ""));
    });
    return { it, cs };
  }, [sectionFilter]);

  const confirmDeleteSection = async () => {
    const ids = students
      .filter((s) => sectionFilter === "all" || s.section === sectionFilter)
      .map((s) => s.id);
    if (!ids.length) {
      toast.info("No students to delete");
      return;
    }
    await del.mutateAsync(ids);
    toast.success(
      `Deleted ${ids.length} student${ids.length === 1 ? "" : "s"}${
        sectionFilter === "all" ? "" : ` from ${sectionFilter}`
      }`,
    );
  };

  const today = formatDate(new Date().toISOString().slice(0, 10));

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto print:p-0 print:space-y-0 print:max-w-none">
      {/* Toolbar (hidden on print) */}
      <Card className="overflow-hidden print:hidden">
        <div className="p-4 md:p-5 flex items-center gap-3">
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">IPC Export</h1>
          <Button size="sm" onClick={() => window.print()} className="bg-gradient-primary">
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
        </div>
        <CardContent className="p-4 grid sm:grid-cols-5 gap-2 pt-0">
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.event_name}</SelectItem>)}
            </SelectContent>
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

      {/* Printable Report */}
      <div className="bg-white text-slate-800 print:bg-white">
        <div className="px-8 py-10 print:px-12 print:py-10 print:break-after-auto">
          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <CcsLogo size={88} rounded={false} className="!rounded-none" />
            <h1
              className="mt-6 font-display uppercase tracking-wide text-3xl print:text-3xl"
              style={{ color: "#1f3a5f" }}
            >
              CCS Attendance Report{event ? `: ${event.event_name}` : ""}
            </h1>
            <p className="mt-2 text-slate-500 text-base">College of Computer Studies Student Council</p>
            <div className="mt-4 h-[3px] w-full" style={{ backgroundColor: "#f59e0b" }} />
          </div>

          {/* Meta */}
          <div className="flex justify-between text-sm mt-6 text-slate-600">
            <div><span className="font-semibold text-slate-800">Date of Report:</span> {today}</div>
            <div><span className="font-semibold text-slate-800">Generated via:</span> Lovable Attendance System</div>
          </div>

          {/* Sections */}
          <div className="mt-8 space-y-8">
            {grid.map((section) => (
              <section key={section.section} className="print:break-inside-avoid">
                <div className="flex items-center gap-3 mb-3">
                  <span className="inline-block w-1.5 h-6" style={{ backgroundColor: "#f59e0b" }} />
                  <h2 className="font-display text-xl font-semibold" style={{ color: "#f59e0b" }}>
                    Section: {section.section}
                  </h2>
                </div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th className="text-left font-semibold px-4 py-3 border border-slate-200" style={{ color: "#1f3a5f" }}>Name</th>
                      {days.map((d) => (
                        <th key={d.id} className="text-left font-semibold px-4 py-3 border border-slate-200" style={{ color: "#1f3a5f" }}>
                          {d.day_label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.students.map((s, idx) => (
                      <tr key={s.id} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                        <td className="px-4 py-3 border border-slate-200 text-slate-800">{s.name}</td>
                        {s.days.map((d, i) => (
                          <td key={i} className="px-4 py-3 border border-slate-200">
                            {d.in || d.out ? (
                              <span className="font-semibold" style={{ color: "#2563eb" }}>
                                {d.in && d.out ? `In: ${d.in} / Out: ${d.out}` : d.in ? `In: ${d.in}` : `Out: ${d.out}`}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {section.students.length === 0 && (
                      <tr>
                        <td colSpan={days.length + 1} className="px-4 py-4 text-center text-slate-400 border border-slate-200">
                          No students.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>
            ))}
            {grid.length === 0 && (
              <div className="p-12 text-center text-slate-400">Pick an event to generate the report.</div>
            )}
          </div>

          {/* Summary + signatories — forced to a new page on print */}
          <div className="mt-12 print:break-before-page">
            <div className="flex items-center gap-3 mb-3">
              <span className="inline-block w-1.5 h-6" style={{ backgroundColor: "#f59e0b" }} />
              <h2 className="font-display text-xl font-semibold" style={{ color: "#f59e0b" }}>
                Participating Sections Summary
              </h2>
            </div>
            <p className="text-slate-600 mb-3">
              The following student groups were registered for the {event?.event_name ?? "event"}:
            </p>
            <ul className="list-disc pl-8 space-y-1 text-slate-700">
              {sectionsByProgram.it.length > 0 && (
                <li><span className="font-semibold text-slate-800">BS Information Technology:</span> {sectionsByProgram.it.join(", ")}</li>
              )}
              {sectionsByProgram.cs.length > 0 && (
                <li><span className="font-semibold text-slate-800">BS Computer Science:</span> {sectionsByProgram.cs.join(", ")}</li>
              )}
            </ul>

            <div className="grid grid-cols-3 gap-8 mt-24 text-center text-sm">
              {(["prepared", "noted", "approved"] as const).map((k) => (
                <div key={k}>
                  <div className="border-t-2 border-slate-800 pt-2">
                    <div className="font-bold uppercase tracking-wider text-slate-800">{k} by</div>
                    <div className="text-slate-600 mt-1">{signatories[k]}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        scope="delete_confirm"
        title="Confirm Delete Students"
        description={
          sectionFilter === "all"
            ? "Enter the delete PIN to permanently remove ALL students."
            : `Enter the delete PIN to permanently remove all students in ${sectionFilter}.`
        }
        onSuccess={confirmDeleteSection}
      />
    </div>
  );
}
