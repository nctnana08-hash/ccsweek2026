import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/admin.ts";

// Public lookup: exact student_id match only. No list endpoints, no email exposure.
const lookupAttempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = lookupAttempts.get(ip);
  if (!rec || rec.resetAt < now) {
    lookupAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    if (rateLimited(ip)) return jsonResponse({ error: "too_many_attempts" }, 429);

    const body = await req.json().catch(() => ({}));
    const student_id = body.student_id;
    if (!student_id || typeof student_id !== "string" || student_id.length > 64) {
      return jsonResponse({ error: "bad_input" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await admin
      .from("students")
      .select("student_id, name, section, status")
      .eq("student_id", student_id)
      .maybeSingle();
    if (error) return jsonResponse({ error: "lookup_failed" }, 500);
    if (!data || data.status !== "enrolled") return jsonResponse({ ok: false });

    return jsonResponse({
      ok: true,
      student: { student_id: data.student_id, name: data.name, section: data.section },
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
