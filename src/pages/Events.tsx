import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEvents, useUpsertEvent, useDeleteEvent } from "@/hooks/useEvents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Archive } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import { PinDialog } from "@/components/PinDialog";
import { usePins } from "@/hooks/useSettings";
import { PINS_DEFAULT } from "@/lib/constants";

export default function Events() {
  const navigate = useNavigate();
  const { data: events = [] } = useEvents();
  const upsert = useUpsertEvent();
  const del = useDeleteEvent();
  const [open, setOpen] = useState(false);
  const { data: pins } = usePins();
  const [pinOpen, setPinOpen] = useState(false);
  const [toDelete, setToDelete] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="ccs-pennants animate-sway -mx-4 md:-mx-6" aria-hidden />
      <Card className="overflow-hidden border-0 shadow-festive ccs-festive-card">
        <div className="relative bg-gradient-hero text-primary-foreground p-5 md:p-6 flex items-center gap-3 overflow-hidden">
          <div className="absolute inset-0 ccs-sunburst opacity-50" aria-hidden />
          <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-flag-yellow/25 blur-3xl" aria-hidden />
          <div className="relative flex-1">
            <div className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-semibold">Manage</div>
            <h1 className="font-display uppercase text-2xl md:text-3xl tracking-wide drop-shadow">Events</h1>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="relative bg-white text-primary hover:bg-white/95 shadow-lg font-semibold">
                <Plus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">New event</span>
              </Button>
            </DialogTrigger>
            <CreateEventDialog onCreate={async (e) => { await upsert.mutateAsync(e); toast.success("Event created"); setOpen(false); }} onClose={() => setOpen(false)} />
          </Dialog>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {events.map((e) => (
          <Card key={e.id} className="hover:shadow-festive transition-shadow cursor-pointer" onClick={() => navigate(`/events/${e.id}`)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-display uppercase tracking-wide text-base truncate">{e.event_name}</h3>
                  {e.status === "archived" && <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" />Archived</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(e.start_date), "MMM d")} – {format(new Date(e.end_date), "MMM d, yyyy")}
                </p>
              </div>
              <Button size="icon" variant="ghost" onClick={(ev) => { ev.stopPropagation(); setToDelete(e.id); setPinOpen(true); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
        {events.length === 0 && (
          <Card><CardContent className="p-10 text-center text-muted-foreground">No events yet. Create your first one to get started.</CardContent></Card>
        )}
      </div>

      <PinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        expectedPin={pins?.delete_confirm ?? PINS_DEFAULT.delete_confirm}
        title="Confirm Delete"
        description="This deletes the event and all its days, slots, and attendance records."
        onSuccess={async () => { if (toDelete) { await del.mutateAsync(toDelete); toast.success("Event deleted"); setToDelete(null); } }}
      />
    </div>
  );
}

function CreateEventDialog({ onCreate, onClose }: { onCreate: (e: any) => Promise<void>; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ event_name: "", start_date: today, end_date: today });
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle className="font-display uppercase tracking-wide">New Event</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <Input placeholder="Event name (e.g. CCS Week 2025)" value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-muted-foreground">Start</label>
            <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">End</label>
            <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-gradient-primary" disabled={!form.event_name} onClick={() => onCreate({ ...form, status: "active" })}>Create</Button>
        </div>
      </div>
    </DialogContent>
  );
}
