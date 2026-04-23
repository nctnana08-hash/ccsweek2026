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

    if (action === "upsert") {
      const s = body.student;
      if (!s?.student_id || !s?.name || !s?.section) return jsonResponse({ error: "bad_input" }, 400);
      const { data, error } = await admin
        .from("students")
        .upsert(s, { onConflict: "student_id" })
        .select()
        .single();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, student: data });
    }

    if (action === "bulk_upsert") {
      const rows = body.rows as Array<Record<string, unknown>>;
      if (!Array.isArray(rows) || !rows.length) return jsonResponse({ error: "bad_input" }, 400);
      if (rows.length > 5000) return jsonResponse({ error: "too_many" }, 400);
      const { data, error } = await admin
        .from("students")
        .upsert(rows, { onConflict: "student_id" })
        .select();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, students: data });
    }

    if (action === "delete") {
      const ids = body.ids as string[];
      if (!Array.isArray(ids) || !ids.length) return jsonResponse({ error: "bad_input" }, 400);
      const { error } = await admin.from("students").delete().in("id", ids);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true });
    }

    if (action === "get_with_email") {
      // Admin can fetch full row including email
      const id = body.id as string;
      if (!id) return jsonResponse({ error: "bad_input" }, 400);
      const { data, error } = await admin.from("students").select("*").eq("id", id).maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, student: data });
    }

    return jsonResponse({ error: "unknown_action" }, 400);
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
