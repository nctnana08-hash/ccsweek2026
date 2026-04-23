import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useEvent, useEventDays, useUpsertEventDay, useDeleteEventDay, useScanSlots, useUpsertScanSlot, useDeleteScanSlot } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Bunting } from "@/components/Bunting";

const TEMPLATES: Record<string, Array<{ label: string; type: "in" | "out" | "custom" }>> = {
  "single": [{ label: "Check-in", type: "in" }],
  "in-out": [{ label: "IN", type: "in" }, { label: "OUT", type: "out" }],
  "morning-afternoon": [
    { label: "Morning IN", type: "in" }, { label: "Morning OUT", type: "out" },
    { label: "Afternoon IN", type: "in" }, { label: "Afternoon OUT", type: "out" },
  ],
};

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event } = useEvent(id);
  const { data: days = [] } = useEventDays(id);
  const upsertDay = useUpsertEventDay();
  const delDay = useDeleteEventDay();
  const upsertSlot = useUpsertScanSlot();
  const today = new Date().toISOString().slice(0, 10);
  const [newDay, setNewDay] = useState({ day_label: "", date: today, template: "in-out" });

  if (!event) return <div className="p-6">Loading…</div>;

  const addDay = async () => {
    if (!newDay.day_label) { toast.error("Day label required"); return; }
    const day = await upsertDay.mutateAsync({ event_id: event.id, day_label: newDay.day_label, date: newDay.date });
    const slots = TEMPLATES[newDay.template] ?? [];
    for (let i = 0; i < slots.length; i++) {
      await upsertSlot.mutateAsync({ day_id: day.id, slot_label: slots[i].label, slot_type: slots[i].type, order: i });
    }
    setNewDay({ day_label: "", date: today, template: "in-out" });
    toast.success("Day added");
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <Card className="overflow-hidden border-0">
        <Bunting />
        <div className="p-4 md:p-5 flex items-center gap-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/events")}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-display uppercase text-xl md:text-2xl tracking-wide truncate">{event.event_name}</h1>
            <p className="text-xs text-muted-foreground">{format(new Date(event.start_date), "MMM d")} – {format(new Date(event.end_date), "MMM d, yyyy")}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base font-display uppercase tracking-wide">Add a day</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-4 gap-2">
          <Input placeholder="Day label" value={newDay.day_label} onChange={(e) => setNewDay({ ...newDay, day_label: e.target.value })} />
          <Input type="date" value={newDay.date} onChange={(e) => setNewDay({ ...newDay, date: e.target.value })} />
          <Select value={newDay.template} onValueChange={(v) => setNewDay({ ...newDay, template: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single check-in</SelectItem>
              <SelectItem value="in-out">IN + OUT</SelectItem>
              <SelectItem value="morning-afternoon">Morning + Afternoon IN/OUT</SelectItem>
              <SelectItem value="custom">Custom (no slots)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={addDay} className="bg-gradient-primary"><Plus className="h-4 w-4 mr-1" />Add day</Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {days.map((d) => <DayCard key={d.id} day={d} onDelete={async () => { await delDay.mutateAsync(d.id); toast.success("Day deleted"); }} />)}
        {days.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No days yet — add one above.</CardContent></Card>}
      </div>
    </div>
  );
}

function DayCard({ day, onDelete }: { day: any; onDelete: () => void }) {
  const { data: slots = [] } = useScanSlots(day.id);
  const upsertSlot = useUpsertScanSlot();
  const delSlot = useDeleteScanSlot();
  const [newSlot, setNewSlot] = useState({ slot_label: "", slot_type: "in" as "in" | "out" | "custom" });
  const addSlot = async () => {
    if (!newSlot.slot_label) return;
    await upsertSlot.mutateAsync({ day_id: day.id, slot_label: newSlot.slot_label, slot_type: newSlot.slot_type, order: slots.length });
    setNewSlot({ slot_label: "", slot_type: "in" });
  };
  const slotColor = (t: string) => t === "in" ? "bg-flag-green" : t === "out" ? "bg-flag-blue" : "bg-flag-yellow";
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center gap-3 space-y-0">
        <Calendar className="h-4 w-4 text-primary" />
        <CardTitle className="text-base flex-1">{day.day_label} <span className="text-xs text-muted-foreground font-normal">· {day.date}</span></CardTitle>
        <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {slots.map((s) => (
            <Badge key={s.id} className={`${slotColor(s.slot_type)} text-white gap-1.5 pl-2 pr-1 py-1`}>
              {s.slot_label}
              <button onClick={() => delSlot.mutate(s.id)} className="hover:bg-black/20 rounded p-0.5"><Trash2 className="h-3 w-3" /></button>
            </Badge>
          ))}
          {slots.length === 0 && <span className="text-xs text-muted-foreground">No slots</span>}
        </div>
        <div className="flex gap-2">
          <Input placeholder="New slot label" value={newSlot.slot_label} onChange={(e) => setNewSlot({ ...newSlot, slot_label: e.target.value })} className="flex-1" />
          <Select value={newSlot.slot_type} onValueChange={(v: any) => setNewSlot({ ...newSlot, slot_type: v })}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">IN</SelectItem>
              <SelectItem value="out">OUT</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={addSlot}><Plus className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
