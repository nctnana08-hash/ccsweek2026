import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Event, EventDay, ScanSlot } from "@/lib/types";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["events", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as Event | null;
    },
  });
}

export function useEventDays(event_id: string | undefined | null) {
  return useQuery({
    queryKey: ["event_days", event_id],
    enabled: !!event_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("event_days").select("*").eq("event_id", event_id!).order("date");
      if (error) throw error;
      return data as EventDay[];
    },
  });
}

export function useScanSlots(day_id: string | undefined | null) {
  return useQuery({
    queryKey: ["scan_slots", day_id],
    enabled: !!day_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("scan_slots").select("*").eq("day_id", day_id!).order("order");
      if (error) throw error;
      return data as ScanSlot[];
    },
  });
}

export function useUpsertEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: Partial<Event> & { event_name: string; start_date: string; end_date: string }) => {
      const { data, error } = await supabase.from("events").upsert(e as any).select().single();
      if (error) throw error;
      return data as Event;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["events"] }),
  });
}

export function useUpsertEventDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (d: Partial<EventDay> & { event_id: string; day_label: string; date: string }) => {
      const { data, error } = await supabase.from("event_days").upsert(d as any).select().single();
      if (error) throw error;
      return data as EventDay;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["event_days", vars.event_id] }),
  });
}

export function useDeleteEventDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_days").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_days"] }),
  });
}

export function useUpsertScanSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<ScanSlot> & { day_id: string; slot_label: string }) => {
      const { data, error } = await supabase.from("scan_slots").upsert(s as any).select().single();
      if (error) throw error;
      return data as ScanSlot;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["scan_slots", vars.day_id] }),
  });
}

export function useDeleteScanSlot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scan_slots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scan_slots"] }),
  });
}
