import { create } from "zustand";
import { ADMIN_SESSION_HOURS, ADMIN_SESSION_KEY } from "@/lib/constants";

interface AdminState {
  unlocked: boolean;
  expiresAt: number | null;
  unlock: () => void;
  lock: () => void;
  hydrate: () => void;
}

const readSession = (): { expiresAt: number | null } => {
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return { expiresAt: null };
    const parsed = JSON.parse(raw);
    if (typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now()) {
      return { expiresAt: parsed.expiresAt };
    }
    return { expiresAt: null };
  } catch {
    return { expiresAt: null };
  }
};

export const useAdmin = create<AdminState>((set) => ({
  unlocked: false,
  expiresAt: null,
  unlock: () => {
    const expiresAt = Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000;
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ expiresAt }));
    set({ unlocked: true, expiresAt });
  },
  lock: () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    set({ unlocked: false, expiresAt: null });
  },
  hydrate: () => {
    const { expiresAt } = readSession();
    set({ unlocked: !!expiresAt, expiresAt });
  },
}));

// Cross-tab sync
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === ADMIN_SESSION_KEY) {
      useAdmin.getState().hydrate();
    }
  });
}
