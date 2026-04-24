import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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
  const qc = useQueryClient();

  // Set up real-time subscription on mount
  useEffect(() => {
    const channel = supabase
      .channel("app_settings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "app_settings",
          filter: "key=eq.active_scan_context",
        },
        (payload) => {
          const nextValue = (payload.new as { value?: ActiveContext } | null)?.value;
          if (nextValue) {
            localStorage.setItem("ccs_active_context", JSON.stringify(nextValue));
            qc.setQueryData(["app_settings", "active_scan_context"], nextValue);
          }
          qc.invalidateQueries({ queryKey: ["app_settings", "active_scan_context"] });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [qc]);

  return useQuery({
    queryKey: ["app_settings", "active_scan_context"],
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      // Fetch from backend (synced across all devices)
      try {
        const res = await api.getActiveContext();
        if (res.ok && res.context) {
          localStorage.setItem("ccs_active_context", JSON.stringify(res.context));
          return res.context as ActiveContext;
        }
      } catch {
        /* fall through to local */
      }
      // Fallback to localStorage if backend fails
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
      // Persist locally as a fast fallback for this device
      localStorage.setItem("ccs_active_context", JSON.stringify(ctx));
      // Push to backend so all other devices receive the change via realtime.
      // This requires admin token — surface the error if it fails.
      await api.events.setActiveContext(ctx);
      return ctx;
    },
    onSuccess: (ctx) => {
      // Optimistically update the cached value so this device reflects immediately
      qc.setQueryData(["app_settings", "active_scan_context"], ctx);
      qc.invalidateQueries({ queryKey: ["app_settings", "active_scan_context"] });
    },
  });
}
