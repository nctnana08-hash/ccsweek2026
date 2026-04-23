import { supabase } from "@/integrations/supabase/client";
import { getAdminToken } from "@/stores/admin";

type FnResponse<T> = { data: T | null; error: { message: string } | null };

async function invoke<T = unknown>(
  name: string,
  body: unknown,
  opts: { admin?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.admin) {
    const token = getAdminToken();
    if (!token) throw new Error("Admin session required");
    headers["x-admin-token"] = token;
  }
  const { data, error } = (await supabase.functions.invoke(name, {
    body,
    headers,
  })) as FnResponse<T & { error?: string }>;
  if (error) throw new Error(error.message);
  if (data && typeof data === "object" && "error" in (data as object) && (data as { error?: string }).error) {
    throw new Error((data as { error: string }).error);
  }
  return data as T;
}

// ---- Public ----
export const api = {
  verifyPin: (scope: "admin" | "date_override" | "delete_confirm" | "qr_checker", pin: string) =>
    invoke<{ ok: boolean; token?: string; expires_in?: number }>("verify-pin", { scope, pin }),

  lookupQr: (student_id: string) =>
    invoke<{ ok: boolean; student?: { student_id: string; name: string; section: string } }>(
      "lookup-qr",
      { student_id },
    ),

  recordAttendance: (input: {
    student_id: string;
    event_id: string;
    day_id: string;
    slot_id: string;
    scanned_at?: string;
  }) =>
    invoke<{
      ok: boolean;
      duplicate?: boolean;
      record?: any;
      error?: string;
    }>("record-attendance", input),

  // ---- Admin-only ----
  updatePins: (pins: Record<string, string>) =>
    invoke<{ ok: boolean }>("update-pins", { pins }, { admin: true }),

  students: {
    upsert: (student: { student_id: string; name: string; section: string; email?: string | null; status?: string }) =>
      invoke<{ ok: boolean; student: any }>(
        "manage-students",
        { action: "upsert", student },
        { admin: true },
      ),
    bulkUpsert: (rows: any[]) =>
      invoke<{ ok: boolean; students: any[] }>(
        "manage-students",
        { action: "bulk_upsert", rows },
        { admin: true },
      ),
    delete: (ids: string[]) =>
      invoke<{ ok: boolean }>("manage-students", { action: "delete", ids }, { admin: true }),
    getWithEmail: (id: string) =>
      invoke<{ ok: boolean; student: any }>(
        "manage-students",
        { action: "get_with_email", id },
        { admin: true },
      ),
  },

  events: {
    upsertEvent: (event: any) =>
      invoke<{ ok: boolean; event: any }>(
        "manage-events",
        { action: "upsert_event", event },
        { admin: true },
      ),
    deleteEvent: (id: string) =>
      invoke<{ ok: boolean }>("manage-events", { action: "delete_event", id }, { admin: true }),
    upsertDay: (day: any) =>
      invoke<{ ok: boolean; day: any }>(
        "manage-events",
        { action: "upsert_day", day },
        { admin: true },
      ),
    deleteDay: (id: string) =>
      invoke<{ ok: boolean }>("manage-events", { action: "delete_day", id }, { admin: true }),
    upsertSlot: (slot: any) =>
      invoke<{ ok: boolean; slot: any }>(
        "manage-events",
        { action: "upsert_slot", slot },
        { admin: true },
      ),
    deleteSlot: (id: string) =>
      invoke<{ ok: boolean }>("manage-events", { action: "delete_slot", id }, { admin: true }),
    deleteAttendance: (ids: string[]) =>
      invoke<{ ok: boolean }>(
        "manage-events",
        { action: "delete_attendance", ids },
        { admin: true },
      ),
    setActiveContext: (context: any) =>
      invoke<{ ok: boolean }>(
        "manage-events",
        { action: "set_active_context", context },
        { admin: true },
      ),
  },
};
