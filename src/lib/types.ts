export interface Student {
  id: string;
  student_id: string;
  name: string;
  email: string | null;
  section: string;
  status: "enrolled" | "inactive" | "graduated";
  created_at: string;
  updated_at: string;
}
export interface Event {
  id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}
export interface EventDay {
  id: string;
  event_id: string;
  day_label: string;
  date: string;
  created_at: string;
}
export interface ScanSlot {
  id: string;
  day_id: string;
  slot_label: string;
  slot_type: "in" | "out" | "custom";
  order: number;
  late_cutoff_time: string | null;
  created_at: string;
}
export interface AttendanceRecord {
  id: string;
  profile_id: string | null;
  student_id: string;
  name: string;
  section: string;
  event_id: string;
  day_id: string;
  slot_id: string;
  slot_label: string;
  scanned_at: string;
  is_late: boolean;
}
export interface ActiveContext {
  event_id: string | null;
  day_id: string | null;
  slot_id: string | null;
}
export interface ScannerSession {
  id: string;
  session_token: string;
  created_at: string;
  expires_at: string;
  locked: boolean;
}
export interface PinSet {
  admin: string;
  date_override: string;
  delete_confirm: string;
  qr_checker: string;
  scanner_pin: string;
}
export interface QrPayload {
  system: "ccs_system";
  type: "student";
  profile_id: string;
  student_id: string;
  last_name: string;
  section: string;
}
