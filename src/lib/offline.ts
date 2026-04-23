import { openDB, type IDBPDatabase } from "idb";
import { api } from "@/lib/api";

const DB_NAME = "ccs-offline";
const STORE = "pending_attendance";

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: "local_id" });
      },
    });
  }
  return dbp;
}

export interface PendingScan {
  local_id: string;
  student_id: string;
  event_id: string;
  day_id: string;
  slot_id: string;
  scanned_at: string;
}

export async function queueScan(rec: PendingScan) {
  const d = await db();
  await d.put(STORE, rec);
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  return d.count(STORE);
}

export async function flushQueue(): Promise<number> {
  const d = await db();
  const all = (await d.getAll(STORE)) as PendingScan[];
  if (!all.length) return 0;
  let synced = 0;
  for (const item of all) {
    const { local_id, ...rec } = item;
    try {
      const res = await api.recordAttendance(rec);
      if (res.ok || res.duplicate) {
        await d.delete(STORE, local_id);
        synced += 1;
      }
    } catch {
      // Leave in queue for next attempt
    }
  }
  return synced;
}
