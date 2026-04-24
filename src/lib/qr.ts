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
  // Generate base QR code
  const qrDataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });

  // Return a promise that resolves with the branded QR code
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const padding = 40;
    const totalSize = size + padding * 2;
    canvas.width = totalSize;
    canvas.height = totalSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(qrDataUrl); // Fallback if canvas context unavailable
      return;
    }

    // Draw white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw gradient border
    const gradient = ctx.createLinearGradient(0, 0, totalSize, totalSize);
    gradient.addColorStop(0, "#ec4899"); // pink
    gradient.addColorStop(0.5, "#3b82f6"); // blue
    gradient.addColorStop(1, "#fbbf24"); // yellow
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, totalSize, padding);
    ctx.fillRect(0, totalSize - padding, totalSize, padding);
    ctx.fillRect(0, padding, padding, totalSize - padding * 2);
    ctx.fillRect(totalSize - padding, padding, padding, totalSize - padding * 2);

    // Draw QR code
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);
      
      // Add CCS branding text at bottom
      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CCS Student Council", totalSize / 2, totalSize - 8);

      // Convert canvas to data URL and resolve
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      // Fallback if image fails to load
      resolve(qrDataUrl);
    };
    img.src = qrDataUrl;
  });
}

export async function downloadStudentQr(s: Pick<Student, "id" | "student_id" | "name" | "section">) {
  const url = await generateQrDataUrl(buildQrPayload(s), 768);
  const a = document.createElement("a");
  a.href = url;
  a.download = `CCS-QR-${s.student_id}.png`;
  a.click();
}
