export const SECTIONS = [
  "BSCS 1A",
  "BSIT 1A",
  "BSIT 1B",
  "BSIT 1C",
  "BSCS 2A & 2B",
  "BSIT 2A",
  "BSIT 2B",
  "BSIT 2C",
  "BSIT 2D",
  "BSCS 3A",
  "BSIT AMG",
  "BSIT SMP",
  "BSIT WMAD A",
  "BSIT WMAD B",
] as const;

export type Section = (typeof SECTIONS)[number];

export const QR_PREFIX = "CCS_QR_V1::";
export const ADMIN_SESSION_HOURS = 8;
export const ADMIN_SESSION_KEY = "ccs_admin_session";
export const ACTIVE_CONTEXT_KEY = "ccs_active_context";
export const PINS_DEFAULT = {
  admin: "47254725",
  date_override: "4724685",
  delete_confirm: "4725555",
  qr_checker: "472005",
};
