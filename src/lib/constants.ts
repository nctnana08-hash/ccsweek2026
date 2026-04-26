export const SECTIONS = [
  "BSCS 1A",
  "BSIT 1A",
  "BSIT 1B",
  "BSIT 1C",
  "BSCS 2A",
  "BSCS 2B",
  "BSIT 2A",
  "BSIT 2B",
  "BSIT 2C",
  "BSIT 2D",
  "BSCS 3A",
  "BSIT 3AMG",
  "BSIT 3SMP",
  "BSIT 3WMAD A",
  "BSIT 3WMAD B",
] as const;

export type Section = (typeof SECTIONS)[number];

export const QR_PREFIX = "CCS_QR_V1::";
export const ADMIN_SESSION_HOURS = 8;
export const ADMIN_SESSION_KEY = "ccs_admin_session";
export const SCANNER_SESSION_KEY = "ccs_scanner_session";
export const SCANNER_SESSION_HOURS = 1;
export const ACTIVE_CONTEXT_KEY = "ccs_active_context";
// PIN defaults intentionally NOT exported — PINs live server-side as bcrypt hashes
// and are verified via the verify-pin edge function. See src/lib/api.ts.
