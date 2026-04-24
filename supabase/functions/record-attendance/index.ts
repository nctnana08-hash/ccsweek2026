import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, jsonResponse } from "../_shared/admin.ts";

const APP_UTC_OFFSET = "+08:00";

// Public endpoint — anyone running the scanner UI can record attendance.
// Validates that the student exists, slot exists, and that the slot belongs
// to the supplied event/day. Late-flag is computed server-side from slot config.

interface ScanInput {
  student_id: string;
  event_id: string;
  day_id: string;
  slot_id: string;
  scanned_at?: string; // ISO; defaults to now
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const input = (await req.json().catch(() => ({}))) as Partial<ScanInput>;
    const { student_id, event_id, day_id, slot_id } = input;
    if (!student_id || !event_id || !day_id || !slot_id) {
      return jsonResponse({ error: "missing_fields" }, 400);
    }
    if ([student_id, event_id, day_id, slot_id].some((v) => typeof v !== "string" || v.length > 128)) {
      return jsonResponse({ error: "bad_input" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Validate student
    const { data: student, error: sErr } = await admin
      .from("students")
      .select("id, student_id, name, section, status")
      .eq("student_id", student_id)
      .maybeSingle();
    if (sErr) return jsonResponse({ error: "student_lookup_failed" }, 500);
    if (!student) return jsonResponse({ error: "unknown_student" }, 404);

    // 2. Validate slot+day+event linkage
    const { data: slot, error: slotErr } = await admin
      .from("scan_slots")
      .select("id, slot_label, slot_type, late_cutoff_time, day_id")
      .eq("id", slot_id)
      .maybeSingle();
    if (slotErr) return jsonResponse({ error: "slot_lookup_failed" }, 500);
    if (!slot || slot.day_id !== day_id) return jsonResponse({ error: "invalid_slot" }, 400);

    const { data: day, error: dayErr } = await admin
      .from("event_days")
      .select("id, event_id, date")
      .eq("id", day_id)
      .maybeSingle();
    if (dayErr) return jsonResponse({ error: "day_lookup_failed" }, 500);
    if (!day || day.event_id !== event_id) return jsonResponse({ error: "invalid_day" }, 400);

    // 3. Compute late flag server-side
    const parsedScanTime = input.scanned_at ? new Date(input.scanned_at) : null;
    const scannedAt = parsedScanTime && !Number.isNaN(parsedScanTime.getTime()) ? parsedScanTime : new Date();
    let isLate = false;
    if (slot.late_cutoff_time) {
      const [hh = 0, mm = 0, ss = 0] = slot.late_cutoff_time.split(":").map(Number);
      const cutoff = new Date(`${day.date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss || 0).padStart(2, "0")}${APP_UTC_OFFSET}`);
      isLate = scannedAt.getTime() > cutoff.getTime();
    }

    // 4. Insert (DB unique constraint or duplicate check)
    const { data: existing } = await admin
      .from("attendance_records")
      .select("id")
      .eq("profile_id", student.id)
      .eq("slot_id", slot_id)
      .maybeSingle();
    if (existing) return jsonResponse({ ok: true, duplicate: true, id: existing.id });

    const { data: inserted, error: insErr } = await admin
      .from("attendance_records")
      .insert({
        student_id: student.student_id,
        profile_id: student.id,
        name: student.name,
        section: student.section,
        event_id,
        day_id,
        slot_id,
        slot_label: slot.slot_label,
        is_late: isLate,
        scanned_at: scannedAt.toISOString(),
      })
      .select()
      .single();
    if (insErr) return jsonResponse({ error: "insert_failed", detail: insErr.message }, 500);

    return jsonResponse({ ok: true, record: inserted });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
