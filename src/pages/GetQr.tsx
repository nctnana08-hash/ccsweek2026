import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTIONS } from "@/lib/constants";
import { Bunting } from "@/components/Bunting";
import { CcsLogo } from "@/components/CcsLogo";
import { supabase } from "@/integrations/supabase/client";
import type { Student } from "@/lib/types";
import { buildQrPayload, generateQrDataUrl } from "@/lib/qr";
import { toast } from "sonner";
import { Download, Mail, ShieldAlert } from "lucide-react";

export default function GetQr() {
  const [form, setForm] = useState({ name: "", student_id: "", email: "", section: SECTIONS[0] as string });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ student: Student; qr: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setNotFound(false); setResult(null);
    try {
      const { data, error } = await supabase.from("students").select("*").eq("student_id", form.student_id.trim()).maybeSingle();
      if (error) throw error;
      if (!data) { setNotFound(true); return; }
      const student = data as Student;
      const qr = await generateQrDataUrl(buildQrPayload(student), 512);
      setResult({ student, qr });
    } catch (err: any) {
      toast.error(err.message ?? "Lookup failed");
    } finally { setLoading(false); }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.qr; a.download = `CCS-QR-${result.student.student_id}.png`; a.click();
  };

  return (
    <div className="min-h-screen ccs-circuit-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="ccs-pennants animate-sway mb-2" aria-hidden />
        <Card className="overflow-hidden border-0 shadow-festive ccs-festive-card">
          <div className="relative bg-gradient-hero text-primary-foreground p-6 flex items-center gap-3 overflow-hidden">
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
              <Input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input required placeholder="Student ID" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })} />
              <Input type="email" placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              <Button type="submit" disabled={loading || !form.name || !form.student_id} className="w-full bg-gradient-primary">
                {loading ? "Looking up…" : "Get my QR"}
              </Button>
              {notFound && (
                <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Not enrolled — please ask your CCS coordinator to add you.</span>
                </div>
              )}
            </form>
          ) : (
            <div className="space-y-3 text-center animate-fade-in">
              <div className="font-display uppercase tracking-wide">{result.student.name}</div>
              <div className="text-xs text-muted-foreground">{result.student.student_id} · {result.student.section}</div>
              <img src={result.qr} alt="Student QR" className="mx-auto rounded-lg border-4 border-primary/20" width={256} height={256} />
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={download} variant="outline"><Download className="h-4 w-4 mr-1.5" />Download</Button>
                <Button onClick={() => toast.info("Email delivery coming soon — please download for now")} variant="outline">
                  <Mail className="h-4 w-4 mr-1.5" />Email
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setResult(null); setForm({ name: "", student_id: "", email: "", section: SECTIONS[0] }); }}>Look up another</Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
