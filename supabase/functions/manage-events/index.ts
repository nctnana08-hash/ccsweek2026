import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  try {
    const body = await req.json().catch(() => ({}));
    const action: string = body.action;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const map: Record<string, () => Promise<Response>> = {
      upsert_event: async () => {
        const e = body.event;
        if (!e?.event_name || !e?.start_date || !e?.end_date) return jsonResponse({ error: "bad_input" }, 400);
        const { data, error } = await admin.from("events").upsert(e).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true, event: data });
      },
      delete_event: async () => {
        const id = body.id;
        if (!id) return jsonResponse({ error: "bad_input" }, 400);
        const { error } = await admin.from("events").delete().eq("id", id);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
      upsert_day: async () => {
        const d = body.day;
        if (!d?.event_id || !d?.day_label || !d?.date) return jsonResponse({ error: "bad_input" }, 400);
        const { data, error } = await admin.from("event_days").upsert(d).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true, day: data });
      },
      delete_day: async () => {
        const id = body.id;
        if (!id) return jsonResponse({ error: "bad_input" }, 400);
        const { error } = await admin.from("event_days").delete().eq("id", id);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
      upsert_slot: async () => {
        const s = body.slot;
        if (!s?.day_id || !s?.slot_label) return jsonResponse({ error: "bad_input" }, 400);
        const { data, error } = await admin.from("scan_slots").upsert(s).select().single();
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true, slot: data });
      },
      delete_slot: async () => {
        const id = body.id;
        if (!id) return jsonResponse({ error: "bad_input" }, 400);
        const { error } = await admin.from("scan_slots").delete().eq("id", id);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
      delete_attendance: async () => {
        const ids = body.ids as string[];
        if (!Array.isArray(ids) || !ids.length) return jsonResponse({ error: "bad_input" }, 400);
        const { error } = await admin.from("attendance_records").delete().in("id", ids);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
      set_active_context: async () => {
        const ctx = body.context;
        if (!ctx) return jsonResponse({ error: "bad_input" }, 400);
        const { error } = await admin
          .from("app_settings")
          .upsert({ key: "active_scan_context", value: ctx });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true });
      },
    };

    const handler = map[action];
    if (!handler) return jsonResponse({ error: "unknown_action" }, 400);
    return await handler();
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
