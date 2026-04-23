import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveContext, PinSet } from "@/lib/types";
import { PINS_DEFAULT } from "@/lib/constants";

export function usePins() {
  return useQuery({
    queryKey: ["app_settings", "pins"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", "pins").maybeSingle();
      if (error) throw error;
      return (data?.value as PinSet) ?? PINS_DEFAULT;
    },
  });
}

export function useUpdatePins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pins: PinSet) => {
      const { error } = await supabase.from("app_settings").upsert({ key: "pins", value: pins as any });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings", "pins"] }),
  });
}

export function useActiveContext() {
  return useQuery({
    queryKey: ["app_settings", "active_scan_context"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "active_scan_context")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as ActiveContext) ?? { event_id: null, day_id: null, slot_id: null };
    },
  });
}

export function useUpdateActiveContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ctx: ActiveContext) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "active_scan_context", value: ctx as any });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings", "active_scan_context"] }),
  });
}
