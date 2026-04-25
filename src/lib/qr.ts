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

export async function generateQrDataUrl(text: string, size = 768): Promise<string> {
  // Generate base QR code — error correction "L" produces fewer modules → easier to scan,
  // larger pixel size keeps it crisp when printed/displayed.
  const qrDataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: "L",
    margin: 3,
    width: size,
    color: { dark: "#1a1a1a", light: "#ffffff" },
  });

  // Wrap with an orange gradient border and CCS branding
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const padding = 48;
    const totalSize = size + padding * 2;
    canvas.width = totalSize;
    canvas.height = totalSize;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      resolve(qrDataUrl);
      return;
    }

    // White background under the QR (keeps quiet zone clean for scanners)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Orange gradient border
    const gradient = ctx.createLinearGradient(0, 0, totalSize, totalSize);
    gradient.addColorStop(0, "#f59e0b"); // amber-500
    gradient.addColorStop(0.5, "#ea7c1a"); // brand orange
    gradient.addColorStop(1, "#c2410c"); // orange-700
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, totalSize, padding);
    ctx.fillRect(0, totalSize - padding, totalSize, padding);
    ctx.fillRect(0, padding, padding, totalSize - padding * 2);
    ctx.fillRect(totalSize - padding, padding, padding, totalSize - padding * 2);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, padding, padding, size, size);

      // CCS branding label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("CCS Student Council", totalSize / 2, totalSize - padding / 2 + 5);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(qrDataUrl);
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
