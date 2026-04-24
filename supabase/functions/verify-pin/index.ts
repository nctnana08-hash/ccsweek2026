import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, issueAdminToken, jsonResponse } from "../_shared/admin.ts";

// Simple in-memory rate limit (per cold start). Best-effort.
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 8;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  if (rec.count > MAX_PER_WINDOW) return true;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    if (rateLimited(ip)) return jsonResponse({ error: "too_many_attempts" }, 429);

    const body = await req.json().catch(() => ({}));
    const scope: string = body.scope;
    const pin: string = body.pin;
    if (!scope || !pin || typeof scope !== "string" || typeof pin !== "string") {
      return jsonResponse({ error: "bad_request" }, 400);
    }
    const allowedScopes = ["admin", "date_override", "delete_confirm", "qr_checker", "scanner_pin"];
    if (!allowedScopes.includes(scope)) return jsonResponse({ error: "bad_scope" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "pins_hashed")
      .maybeSingle();
    if (error) return jsonResponse({ error: "settings_error" }, 500);

    const hashes = (data?.value ?? {}) as Record<string, string>;
    const hash = hashes[scope];
    if (!hash) return jsonResponse({ ok: false }, 200);

    // Verify with crypt() via RPC
    const { data: cmp, error: cmpErr } = await admin.rpc("verify_pin_hash", {
      _pin: pin,
      _hash: hash,
    });
    if (cmpErr) return jsonResponse({ error: "verify_error" }, 500);
    if (!cmp) return jsonResponse({ ok: false }, 200);

    // Issue admin token for "admin" scope; session token for "scanner_pin"; ok flag for others.
    if (scope === "admin") {
      const token = await issueAdminToken(8 * 60 * 60);
      return jsonResponse({ ok: true, token, expires_in: 8 * 60 * 60 });
    }
    if (scope === "scanner_pin") {
      const token = await issueAdminToken(1 * 60 * 60);
      return jsonResponse({ ok: true, session_token: token, expires_in: 1 * 60 * 60 });
    }
    return jsonResponse({ ok: true });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
