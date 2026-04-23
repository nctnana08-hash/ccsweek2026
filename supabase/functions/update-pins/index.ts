import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse, requireAdmin } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const unauth = await requireAdmin(req);
  if (unauth) return unauth;

  try {
    const body = await req.json().catch(() => ({}));
    const pins = body.pins as Record<string, string>;
    if (!pins || typeof pins !== "object") return jsonResponse({ error: "bad_request" }, 400);

    const allowed = ["admin", "date_override", "delete_confirm", "qr_checker"];
    const cleaned: Record<string, string> = {};
    for (const k of allowed) {
      const v = pins[k];
      if (typeof v === "string" && v.length >= 4 && v.length <= 32) cleaned[k] = v;
    }
    if (!Object.keys(cleaned).length) return jsonResponse({ error: "no_valid_pins" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get current hashed map, merge updates
    const { data: existing } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "pins_hashed")
      .maybeSingle();
    const current = (existing?.value ?? {}) as Record<string, string>;

    // Hash via RPC
    const { data: hashed, error: hashErr } = await admin.rpc("hash_pins", { _pins: cleaned });
    if (hashErr) return jsonResponse({ error: "hash_error", detail: hashErr.message }, 500);

    const next = { ...current, ...(hashed as Record<string, string>) };

    const { error: upErr } = await admin
      .from("app_settings")
      .upsert({ key: "pins_hashed", value: next });
    if (upErr) return jsonResponse({ error: "save_error" }, 500);

    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
