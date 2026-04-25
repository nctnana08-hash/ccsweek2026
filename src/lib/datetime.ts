import { format } from "date-fns";

export function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const dmy = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const yearNum = Number(y) < 100 ? Number(y) + 2000 : Number(y);
    const dayNum = Number(d);
    const monthNum = Number(m);
    if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return null;

    const result = new Date(Date.UTC(yearNum, monthNum - 1, dayNum));
    if (result.getUTCDate() !== dayNum || result.getUTCMonth() !== monthNum - 1) return null;
    return result;
  }

  const iso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const result = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (result.getUTCDate() !== Number(iso[3]) || result.getUTCMonth() !== Number(iso[2]) - 1) return null;
    return result;
  }

  return null;
}

export function formatDateOnly(dateStr: string, pattern: string): string {
  const parsed = parseDate(dateStr);
  return parsed ? format(parsed, pattern) : dateStr;
}

export function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}