import { create } from "zustand";
import { ADMIN_SESSION_HOURS, ADMIN_SESSION_KEY } from "@/lib/constants";

interface AdminState {
  unlocked: boolean;
  token: string | null;
  expiresAt: number | null;
  unlock: (token: string, ttlSeconds?: number) => void;
  lock: () => void;
  hydrate: () => void;
}

interface StoredSession {
  token: string;
  expiresAt: number;
}

const readSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.token === "string" &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return { token: parsed.token, expiresAt: parsed.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
};

export const useAdmin = create<AdminState>((set) => ({
  unlocked: false,
  token: null,
  expiresAt: null,
  unlock: (token, ttlSeconds = ADMIN_SESSION_HOURS * 60 * 60) => {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ token, expiresAt }));
    set({ unlocked: true, token, expiresAt });
  },
  lock: () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    set({ unlocked: false, token: null, expiresAt: null });
  },
  hydrate: () => {
    const s = readSession();
    set({
      unlocked: !!s,
      token: s?.token ?? null,
      expiresAt: s?.expiresAt ?? null,
    });
  },
}));

// Convenience accessor for callers that aren't React components
export const getAdminToken = (): string | null => useAdmin.getState().token;

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ADMIN_SESSION_KEY) useAdmin.getState().hydrate();
  });
}
