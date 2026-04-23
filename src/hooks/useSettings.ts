import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveContext } from "@/lib/types";
import { api } from "@/lib/api";

// PINs are no longer client-readable. Hooks for plaintext PIN access have been removed.
// PIN verification goes through the verify-pin edge function (see src/lib/api.ts).
// PIN updates go through update-pins (admin-only).

export function useUpdatePins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pins: Record<string, string>) => {
      await api.updatePins(pins);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}

export function useActiveContext() {
  return useQuery({
    queryKey: ["app_settings", "active_scan_context"],
    queryFn: async () => {
      // active_scan_context is also stored in app_settings, which is now backend-only.
      // Mirror it to localStorage for the public scanner UI.
      const local = localStorage.getItem("ccs_active_context");
      if (local) {
        try {
          return JSON.parse(local) as ActiveContext;
        } catch {
          /* fall through */
        }
      }
      return { event_id: null, day_id: null, slot_id: null } as ActiveContext;
    },
  });
}

export function useUpdateActiveContext() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ctx: ActiveContext) => {
      // Persist locally so any device running the scanner has its own context
      localStorage.setItem("ccs_active_context", JSON.stringify(ctx));
      // Best-effort sync to backend if admin token is available
      try {
        await api.events.setActiveContext(ctx);
      } catch {
        /* admin-only; ignore when not unlocked */
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings", "active_scan_context"] }),
  });
}
