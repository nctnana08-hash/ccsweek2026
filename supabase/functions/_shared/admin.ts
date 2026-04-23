// Shared helpers for admin-token verification & CORS.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getKey(): Promise<CryptoKey> {
  // Derive a stable HMAC key from the service role key. This key never leaves the function runtime.
  const seed = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const material = await crypto.subtle.digest("SHA-256", enc.encode("ccs-admin-token-v1::" + seed));
  return await crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export interface AdminClaims {
  scope: "admin";
  iat: number;
  exp: number;
}

export async function issueAdminToken(ttlSeconds = 8 * 60 * 60): Promise<string> {
  const claims: AdminClaims = {
    scope: "admin",
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  const key = await getKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}

export async function verifyAdminToken(token: string | null): Promise<AdminClaims | null> {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const key = await getKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    fromB64url(sig),
    enc.encode(payload),
  );
  if (!ok) return null;
  try {
    const claims = JSON.parse(dec.decode(fromB64url(payload))) as AdminClaims;
    if (claims.scope !== "admin") return null;
    if (claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function requireAdmin(req: Request): Promise<Response | null> {
  const token = req.headers.get("x-admin-token");
  const claims = await verifyAdminToken(token);
  if (!claims) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
