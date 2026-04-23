import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRecord } from "@/lib/types";
import { api } from "@/lib/api";

export interface AttendanceFilters {
  event_id?: string;
  day_id?: string;
  slot_id?: string;
  section?: string;
  search?: string;
  from?: string;
  to?: string;
}

const PAGE = 1000;

async function fetchAll(filters: AttendanceFilters): Promise<AttendanceRecord[]> {
  const out: AttendanceRecord[] = [];
  let from = 0;
  for (;;) {
    let q = supabase.from("attendance_records").select("*").order("scanned_at", { ascending: false }).range(from, from + PAGE - 1);
    if (filters.event_id) q = q.eq("event_id", filters.event_id);
    if (filters.day_id) q = q.eq("day_id", filters.day_id);
    if (filters.slot_id) q = q.eq("slot_id", filters.slot_id);
    if (filters.section) q = q.eq("section", filters.section);
    if (filters.from) q = q.gte("scanned_at", filters.from);
    if (filters.to) q = q.lte("scanned_at", filters.to);
    if (filters.search) q = q.or(`name.ilike.%${filters.search}%,student_id.ilike.%${filters.search}%`);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as AttendanceRecord[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

export function useAttendance(filters: AttendanceFilters) {
  return useQuery({
    queryKey: ["attendance", filters],
    queryFn: () => fetchAll(filters),
  });
}

export function useRealtimeAttendance() {
  const qc = useQueryClient();
  useEffect(() => {
    const ch = supabase
      .channel("attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, () => {
        qc.invalidateQueries({ queryKey: ["attendance"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);
}

export interface RecordScanInput {
  student_id: string;
  event_id: string;
  day_id: string;
  slot_id: string;
  scanned_at?: string;
}

export function useRecordScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: RecordScanInput) => {
      const res = await api.recordAttendance(rec);
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}

export function useExistingScan(profile_id: string | null, slot_id: string | null) {
  return useQuery({
    queryKey: ["attendance", "exists", profile_id, slot_id],
    enabled: !!profile_id && !!slot_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("profile_id", profile_id!)
        .eq("slot_id", slot_id!)
        .maybeSingle();
      if (error) throw error;
      return data as AttendanceRecord | null;
    },
  });
}
