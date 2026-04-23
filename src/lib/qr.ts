import QRCode from "qrcode";
import type { Student, QrPayload } from "./types";
import { QR_PREFIX } from "./constants";

export function buildQrPayload(s: Pick<Student, "id" | "student_id" | "name" | "section">): string {
  const lastName = s.name.split(" ").slice(-1)[0] || s.name;
  const payload: QrPayload = {
    system: "ccs_system",
    type: "student",
    profile_id: s.id,
    student_id: s.student_id,
    last_name: lastName,
    section: s.section,
  };
  return QR_PREFIX + btoa(JSON.stringify(payload));
}

export function parseQrPayload(raw: string): QrPayload | null {
  if (!raw.startsWith(QR_PREFIX)) return null;
  try {
    const obj = JSON.parse(atob(raw.slice(QR_PREFIX.length)));
    if (obj?.system === "ccs_system" && obj?.type === "student") return obj as QrPayload;
    return null;
  } catch {
    return null;
  }
}

export async function generateQrDataUrl(text: string, size = 512): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });
}

export async function downloadStudentQr(s: Pick<Student, "id" | "student_id" | "name" | "section">) {
  const url = await generateQrDataUrl(buildQrPayload(s), 768);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CCS-QR-${s.student_id}.png`;
  a.click();
}
