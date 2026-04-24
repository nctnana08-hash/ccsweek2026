import { create } from "zustand";
import { SCANNER_SESSION_HOURS, SCANNER_SESSION_KEY } from "@/lib/constants";

interface ScannerState {
  sessionToken: string | null;
  expiresAt: number | null;
  locked: boolean;
  unlock: (token: string, ttlSeconds?: number) => void;
  lock: () => void;
  endSession: () => void;
  hydrate: () => void;
  isExpired: () => boolean;
}

interface StoredSession {
  sessionToken: string;
  expiresAt: number;
}

const readSession = (): StoredSession | null => {
  try {
    const raw = localStorage.getItem(SCANNER_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.sessionToken === "string" &&
      typeof parsed.expiresAt === "number" &&
      parsed.expiresAt > Date.now()
    ) {
      return { sessionToken: parsed.sessionToken, expiresAt: parsed.expiresAt };
    }
    return null;
  } catch {
    return null;
  }
};

export const useScanner = create<ScannerState>((set, get) => ({
  sessionToken: null,
  expiresAt: null,
  locked: false,
  unlock: (token, ttlSeconds = SCANNER_SESSION_HOURS * 60 * 60) => {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    localStorage.setItem(SCANNER_SESSION_KEY, JSON.stringify({ sessionToken: token, expiresAt }));
    set({ sessionToken: token, expiresAt, locked: false });
  },
  lock: () => {
    set({ locked: true });
  },
  endSession: () => {
    localStorage.removeItem(SCANNER_SESSION_KEY);
    set({ sessionToken: null, expiresAt: null, locked: false });
  },
  hydrate: () => {
    const s = readSession();
    set({
      sessionToken: s?.sessionToken ?? null,
      expiresAt: s?.expiresAt ?? null,
      locked: false,
    });
  },
  isExpired: () => {
    const state = get();
    return !state.sessionToken || !state.expiresAt || state.expiresAt < Date.now();
  },
}));

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === SCANNER_SESSION_KEY) useScanner.getState().hydrate();
  });
}
