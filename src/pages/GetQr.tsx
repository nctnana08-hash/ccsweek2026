import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";
import { api } from "@/lib/api";
import { buildQrPayload, generateQrDataUrl } from "@/lib/qr";
import { toast } from "sonner";
import { Download, Mail, ShieldAlert } from "lucide-react";

interface PublicStudent {
  id: string; // synthesized for QR payload (uses student_id)
  student_id: string;
  name: string;
  section: string;
}

// Forgiving name matching: case-insensitive, ignores spaces/punctuation/accents
function fuzzyMatchName(input: string, stored: string): boolean {
  const normalize = (s: string) => {
    return s
      .toLowerCase()
      .replace(/[.\s\-,]/g, "") // Remove spaces, periods, hyphens, commas
      .replace(/[áàâäã]/g, "a")
      .replace(/[éèêë]/g, "e")
      .replace(/[íìîï]/g, "i")
      .replace(/[óòôöõ]/g, "o")
      .replace(/[úùûü]/g, "u")
      .replace(/[ç]/g, "c")
      .replace(/[ñ]/g, "n");
  };
  const normalizedInput = normalize(input);
  const normalizedStored = normalize(stored);
  // Exact match or substring match (stored contains input or vice versa)
  return normalizedInput === normalizedStored || 
         normalizedStored.includes(normalizedInput) ||
         normalizedInput.includes(normalizedStored);
}

export default function GetQr() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ student: PublicStudent; qr: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotFound(false);
    setResult(null);
    const trimmedId = studentId.trim();
    const trimmedName = studentName.trim();
    if (!trimmedId || !trimmedName) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    try {
      const res = await api.lookupQr(trimmedId);
      if (!res.ok || !res.student) {
        setNotFound(true);
        return;
      }
      // Check if name matches (fuzzy matching)
      if (!fuzzyMatchName(trimmedName, res.student.name)) {
        setNotFound(true);
        return;
      }
      // The public lookup intentionally does NOT return the internal UUID.
      // The QR payload uses the student_id as a stable public identifier.
      const student: PublicStudent = {
        id: res.student.student_id,
        student_id: res.student.student_id,
        name: res.student.name,
        section: res.student.section,
      };
      const qr = await generateQrDataUrl(buildQrPayload(student), 768);
      setResult({ student, qr });
    } catch (err: any) {
      toast.error(err.message ?? "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!result) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = 1100;          // overall card width (bigger)
    const qrSize = 880;         // big QR for easy scanning
    const headerH = 140;
    const footerH = 180;

    canvas.width = size;
    canvas.height = headerH + qrSize + footerH;

    // Background
    ctx.fillStyle = "#f5e6d3";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Orange gradient header
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, "#f59e0b");
    gradient.addColorStop(0.5, "#ea7c1a");
    gradient.addColorStop(1, "#c2410c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, headerH);

    // Header text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px 'Oswald', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("CCS ATTENDANCE", size / 2, 60);
    ctx.font = "20px 'Inter', sans-serif";
    ctx.fillText("Student Council", size / 2, 95);

    // Generate a large, low-density QR fresh for the download (less crammed than display)
    const printQr = await generateQrDataUrl(buildQrPayload(result.student), 1024);

    const qrImg = new Image();
    qrImg.onload = () => {
      const qrX = (size - qrSize) / 2;
      const qrY = headerH + 10;
      // White backing for quiet zone
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

      // Student info
      ctx.fillStyle = "#333333";
      ctx.font = "bold 30px 'Oswald', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(result.student.name, size / 2, headerH + qrSize + 70);

      ctx.fillStyle = "#666666";
      ctx.font = "22px 'Courier New', monospace";
      ctx.fillText(
        result.student.student_id + " · " + result.student.section,
        size / 2,
        headerH + qrSize + 110,
      );

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `CCS-QR-${result.student.student_id}.png`;
      link.click();
    };
    qrImg.src = printQr;
  };

  return (
    <div className="min-h-screen ccs-circuit-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="ccs-pennants animate-sway mb-2" aria-hidden />
        <Card className="overflow-hidden border-0 shadow-festive ccs-festive-card">
          <div className="relative bg-gradient-orange text-primary-foreground p-6 flex items-center gap-3 overflow-hidden">
            <div className="absolute inset-0 ccs-sunburst opacity-60" aria-hidden />
            <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-flag-yellow/30 blur-2xl" aria-hidden />
            <div className="absolute -left-6 -bottom-8 w-32 h-32 rounded-full bg-flag-red/25 blur-2xl" aria-hidden />
            <CcsLogo size={60} className="relative ring-4 ring-white/60 animate-float shadow-xl" />
            <div className="relative">
              <div className="text-[10px] uppercase tracking-[0.3em] opacity-80 font-semibold">Self-service</div>
              <h1 className="font-display uppercase text-2xl tracking-wide drop-shadow">Get your QR</h1>
              <p className="text-xs opacity-90 mt-0.5">CCS Student Council</p>
            </div>
          </div>
          <CardContent className="p-5 space-y-4">
            {!result ? (
              <form onSubmit={lookup} className="space-y-3">
                <p className="text-sm text-muted-foreground">Verify your identity to download your QR code</p>
                <Input
                  required
                  autoFocus
                  placeholder="Student ID"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  maxLength={32}
                />
                <Input
                  required
                  placeholder="Full Name"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  maxLength={128}
                />
                <Button
                  type="submit"
                  disabled={loading || !studentId.trim() || !studentName.trim()}
                  className="w-full bg-gradient-primary"
                >
                  {loading ? "Verifying…" : "Get my QR"}
                </Button>
                {notFound && (
                  <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>No match found. Check your ID and name spelling, or ask your CCS coordinator to add you.</span>
                  </div>
                )}
              </form>
            ) : (
              <div className="space-y-4 text-center animate-fade-in">
                <div className="bg-gradient-orange text-white p-4 rounded-t-lg">
                  <div className="font-display uppercase tracking-wide text-base mb-1">Your QR Code</div>
                  <div className="text-xs opacity-90">CCS Student Council</div>
                </div>
                
                <div className="p-4 bg-orange-50/50 flex justify-center">
                  <div className="rounded-xl" style={{
                    padding: 10,
                    background: "linear-gradient(135deg, hsl(38 95% 55%) 0%, hsl(22 90% 50%) 60%, hsl(15 85% 42%) 100%)",
                    boxShadow: "0 12px 30px rgba(194,65,12,0.25)"
                  }}>
                    <img
                      src={result.qr}
                      alt="Student QR"
                      className="rounded-lg block bg-white"
                      style={{ width: 320, height: 320 }}
                    />
                  </div>
                </div>

                <div className="px-4 pb-4 bg-orange-50 rounded-b-lg">
                  <div className="font-display uppercase tracking-wide text-sm text-orange-900 mb-1">{result.student.name}</div>
                  <div className="text-xs text-orange-700 font-mono mb-3">
                    {result.student.student_id} · {result.student.section}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Button onClick={download} className="bg-gradient-orange text-white hover:opacity-90">
                      <Download className="h-4 w-4 mr-1.5" />
                      Download
                    </Button>
                    <Button onClick={() => toast.info("Email delivery coming soon — please download for now")} variant="outline">
                      <Mail className="h-4 w-4 mr-1.5" />
                      Email
                    </Button>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setResult(null);                      setStudentId("");
                      setStudentName("");                      setStudentId("");
                    }}
                  >
                    Look up another
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
