import * as XLSX from "xlsx";
import { SECTIONS } from "@/lib/constants";

export interface ImportRow {
  student_id: string;
  name: string;
  section: string;
  email: string | null;
  status: "enrolled";
}

const SECTION_SET = new Set<string>(SECTIONS as readonly string[]);

/**
 * Normalize a free-form section / sheet-name to one of our canonical SECTIONS.
 * Examples:
 *   "BSCS 2B"       -> "BSCS 2B"
 *   "BSIT 3AMG"     -> "BSIT 3AMG"
 *   "BSIT 3WMAD A"  -> "BSIT 3WMAD A"
 *   "bscs2a"        -> "BSCS 2A"
 *   "BSIT WMAD A"   -> "BSIT 3WMAD A" (best-effort)
 */
export function normalizeSection(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/\s+/g, " ").trim();
  if (SECTION_SET.has(cleaned)) return cleaned;
  // Strip spaces for matching
  const compact = cleaned.replace(/\s+/g, "");
  for (const s of SECTIONS) {
    if (s.replace(/\s+/g, "") === compact) return s;
  }
  // Best-effort: handle missing year digits e.g. "BSIT WMAD A" -> "BSIT 3WMAD A"
  for (const s of SECTIONS) {
    const sCompact = s.replace(/\s+/g, "");
    if (sCompact.replace(/[0-9]/g, "") === compact.replace(/[0-9]/g, "")) return s;
  }
  return null;
}

const titleCase = (s: string) =>
  s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => (w.length > 1 && /^(de|del|la|los|y|of|the|dl|dr|jr|sr|iii|ii|iv|n|m|d|c|p|t|s|l|r|j|a)$/i.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");

/**
 * Parse an .xlsx workbook. Reads EVERY sheet:
 * - Uses the sheet name as the section (normalized via normalizeSection).
 * - Auto-detects the header row by finding the row that contains a "STUDENT ID"-like label.
 * - Picks columns by header (STUDENT ID / NAME / EMAIL).
 * - Gracefully ignores empty or notes-only rows.
 */
export function parseClassListWorkbook(buf: ArrayBuffer): {
  rows: ImportRow[];
  warnings: string[];
} {
  const wb = XLSX.read(buf, { type: "array" });
  const rows: ImportRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>(); // dedupe within one upload by student_id

  for (const sheetName of wb.SheetNames) {
    const section = normalizeSection(sheetName);
    if (!section) {
      warnings.push(`Skipped sheet "${sheetName}" — unknown section`);
      continue;
    }
    const sheet = wb.Sheets[sheetName];
    const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: true, defval: "" });

    // Find header row: one of the cells looks like "STUDENT ID" / "ID" / "STUDENT NAME"
    let headerIdx = -1;
    for (let i = 0; i < Math.min(grid.length, 25); i++) {
      const r = (grid[i] || []).map((c) => String(c ?? "").trim().toUpperCase());
      if (r.some((c) => /STUDENT\s*ID|^ID$/.test(c)) && r.some((c) => /NAME/.test(c))) {
        headerIdx = i;
        break;
      }
    }

    let idCol = 0;
    let nameCol = 1;
    let emailCol = 2;
    let dataStart = 0;
    if (headerIdx >= 0) {
      const header = (grid[headerIdx] || []).map((c) => String(c ?? "").trim().toUpperCase());
      header.forEach((h, idx) => {
        if (/STUDENT\s*ID|^ID$/.test(h)) idCol = idx;
        else if (/NAME/.test(h)) nameCol = idx;
        else if (/E-?MAIL/.test(h)) emailCol = idx;
      });
      dataStart = headerIdx + 1;
    } else {
      // Heuristic: first column = id, second = name. Skip first row if it looks like a header.
      dataStart = 0;
    }

    let added = 0;
    for (let i = dataStart; i < grid.length; i++) {
      const row = grid[i] || [];
      const rawId = String(row[idCol] ?? "").trim();
      const rawName = String(row[nameCol] ?? "").trim();
      const rawEmail = String(row[emailCol] ?? "").trim();
      if (!rawId || !rawName) continue;
      // Skip rows that don't look like a student id (must contain at least one digit)
      if (!/\d/.test(rawId)) continue;
      if (rawId.toUpperCase().includes("STUDENT")) continue; // stray header
      if (seen.has(rawId)) continue;
      seen.add(rawId);
      rows.push({
        student_id: rawId,
        name: titleCase(rawName),
        section,
        email: rawEmail && /@/.test(rawEmail) ? rawEmail.toLowerCase() : null,
        status: "enrolled",
      });
      added++;
    }
    if (added === 0) warnings.push(`No students found in sheet "${sheetName}"`);
  }

  return { rows, warnings };
}
