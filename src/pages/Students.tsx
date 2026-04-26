import { useState, useMemo, useRef } from "react";
import { useStudents, useUpsertStudent, useDeleteStudents, useBulkInsertStudents } from "@/hooks/useStudents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SECTIONS } from "@/lib/constants";
import { PinDialog } from "@/components/PinDialog";
import { Plus, Trash2, Upload, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Bunting } from "@/components/Bunting";
import { parseClassListWorkbook } from "@/lib/import";
import { downloadStudentQr } from "@/lib/qr";

export default function Students() {
  const { data: students = [] } = useStudents();
  const upsert = useUpsertStudent();
  const del = useDeleteStudents();
  const bulkInsert = useBulkInsertStudents();
  
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<"delete" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (sectionFilter !== "all" && s.section !== sectionFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (search && !`${s.name} ${s.student_id} ${s.email ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [students, search, sectionFilter, statusFilter]);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };

  const handleDelete = () => { setPinPurpose("delete"); setPinOpen(true); };
  const confirmDelete = async () => {
    await del.mutateAsync(Array.from(selected));
    toast.success(`Deleted ${selected.size} students`);
    setSelected(new Set());
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const { rows, warnings } = parseClassListWorkbook(buf);
      if (!rows.length) {
        toast.error("No valid student rows found in the file");
        return;
      }
      // Existing roster — used to count added vs updated vs unchanged.
      const existingById = new Map(students.map((s) => [s.student_id, s]));
      let added = 0, updated = 0, unchanged = 0;
      const toUpsert: typeof rows = [];
      for (const r of rows) {
        const cur = existingById.get(r.student_id);
        if (!cur) { added++; toUpsert.push(r); continue; }
        if (cur.name !== r.name || cur.section !== r.section || (cur.email ?? null) !== (r.email ?? null)) {
          updated++;
          toUpsert.push(r);
        } else {
          unchanged++;
        }
      }
      if (!toUpsert.length) {
        toast.info(`No changes — ${unchanged} students already up to date`);
      } else {
        await bulkInsert.mutateAsync(toUpsert);
        toast.success(
          `Imported ${rows.length} rows · ${added} added, ${updated} updated, ${unchanged} unchanged`
        );
      }
      warnings.slice(0, 4).forEach((w) => toast.warning(w));
    } catch (err: any) {
      toast.error(err?.message ?? "Import failed");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="bg-card p-4 md:p-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide flex-1">Students</h1>
          <Badge variant="secondary">{students.length} total</Badge>
          <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Import Excel</span>
          </Button>
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-gradient-primary">
                <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Add</span>
              </Button>
            </DialogTrigger>
            <CreateStudentDialog onClose={() => setCreateOpen(false)} onCreate={async (s) => { await upsert.mutateAsync(s); toast.success("Student added"); setCreateOpen(false); }} />
          </Dialog>
        </div>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Search name / ID / email" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[180px]" />
        <Select value={sectionFilter} onValueChange={setSectionFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sections</SelectItem>
            {SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="enrolled">Enrolled</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="graduated">Graduated</SelectItem>
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-1.5" />Delete ({selected.size})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 w-8"><Checkbox checked={selected.size > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></th>
                <th className="px-3 py-2 text-left">Student ID</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Section</th>
                <th className="px-3 py-2 text-left hidden md:table-cell">Email</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={(v) => {
                      const ns = new Set(selected); if (v) ns.add(s.id); else ns.delete(s.id); setSelected(ns);
                    }} />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{s.student_id}</td>
                  <td className="px-3 py-2">
                    <div>{s.name}</div>
                    <div className="text-xs text-muted-foreground md:hidden">{s.section}</div>
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">{s.section}</td>
                  <td className="px-3 py-2 hidden md:table-cell text-xs">{s.email}</td>
                  <td className="px-3 py-2">
                    <Badge variant={s.status === "enrolled" ? "default" : "secondary"} className={s.status === "enrolled" ? "bg-flag-green" : ""}>
                      {s.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" onClick={() => downloadStudentQr(s)} title="Download QR">
                      <QrCode className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No students found</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        scope="delete_confirm"
        title="Confirm Delete"
        description={`Enter delete-confirm PIN to remove ${selected.size} student(s).`}
        onSuccess={() => { if (pinPurpose === "delete") confirmDelete(); }}
      />
    </div>
  );
}

function CreateStudentDialog({ onCreate, onClose }: { onCreate: (s: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState({ student_id: "", name: "", email: "", section: SECTIONS[0] as string });
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">Add Student</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Student ID" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
        <Input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Email (optional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-primary" disabled={!form.student_id || !form.name} onClick={() => onCreate({ ...form, email: form.email || null, status: "enrolled" })}>
            Create
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}
