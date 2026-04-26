# CCS Week 2026 Codebase Exploration Summary

## 1. Attendance/Time In-Out Data Structure

### Database Schema
The attendance system is built on a hierarchical database structure:

- **`students`** table: Student master data
  - `id` (UUID, PK)
  - `student_id` (TEXT, unique)
  - `name`, `email`, `section`, `status` (enrolled/inactive/graduated)
  - Indexes on `section` and `status`

- **`events`** table: Event metadata
  - `id` (UUID, PK)
  - `event_name`, `start_date`, `end_date`
  - `status` (active/archived)

- **`event_days`** table: Days within an event
  - `id` (UUID, PK)
  - `event_id` (FK to events, ON DELETE CASCADE)
  - `day_label`, `date`
  - Indexes on `event_id`, `date`

- **`scan_slots`** table: Time slots (in/out) for each day
  - `id` (UUID, PK)
  - `day_id` (FK to event_days, ON DELETE CASCADE)
  - `slot_label`, `slot_type` (in/out/custom)
  - `late_cutoff_time` (TIME, optional)
  - `order` (sequence)

- **`attendance_records`** table: Individual attendance scans
  - `id` (UUID, PK)
  - `profile_id` (FK to students.id)
  - `student_id`, `name`, `section` (denormalized)
  - `event_id`, `day_id`, `slot_id` (FKs)
  - `slot_label` (denormalized)
  - `scanned_at` (TIMESTAMPTZ, defaults to now())
  - `is_late` (BOOLEAN, computed server-side)
  - **UNIQUE constraint**: `(profile_id, slot_id)` — prevents duplicate scans for same student/slot
  - Indexes on event_id, day_id, slot_id, student_id, section, scanned_at

### Data Flow for Time In/Out
1. Scanner submits QR code → `/record-attendance` function
2. Function validates: student exists, slot exists, linkage correct
3. Server computes `is_late` based on `late_cutoff_time` from slot config
4. Record inserted into `attendance_records` table with unique constraint
5. Duplicate detection: if (profile_id, slot_id) already exists, returns `duplicate: true`

---

## 2. PIN-Based Verification Implementation

### PIN Storage & Hashing
- **Storage**: `app_settings` table, key `"pins_hashed"` contains JSONB with scopes → bcrypt hashes
- **Hashing**: Via PostgreSQL `crypt()` function with bcrypt salt (cost 10)
- **Verification**: `/verify-pin` function calls `verify_pin_hash` RPC function

### PIN Scopes (5 types)
Located in [supabase/functions/verify-pin/index.ts](supabase/functions/verify-pin/index.ts):
1. **`admin`** — Full access to Dashboard, Students, Events, Records, Absences, IPC
2. **`scanner_pin`** — Unlock scanner for 1 hour (separate session token)
3. **`date_override`** — Allow recording attendance outside active event dates
4. **`delete_confirm`** — Required to delete students, attendance, events, days, slots
5. **`qr_checker`** — Standalone QR verification utility

### PIN Verification Flow
1. Frontend submits PIN + scope to `/verify-pin` endpoint
2. Endpoint rate-limits (8 attempts per 60s per IP)
3. Retrieves `pins_hashed` from `app_settings`
4. Calls `verify_pin_hash(pin, hash)` RPC
5. On success:
   - **`admin` scope**: Issues admin token (8 hours TTL)
   - **`scanner_pin` scope**: Issues session token (1 hour TTL)
   - **Other scopes**: Returns `ok: true` flag (no token)

### Admin Token Implementation
- Custom JWT-like token using HMAC-SHA256
- Derived from `SUPABASE_SERVICE_ROLE_KEY`
- Format: `{base64_payload}.{base64_signature}` where payload contains `{scope: "admin", iat, exp}`
- Verified via `verifyAdminToken()` in [supabase/functions/_shared/admin.ts](supabase/functions/_shared/admin.ts)
- Requires `x-admin-token` header for protected endpoints

---

## 3. Existing Delete/Reset Functionality

### Current Delete Operations
All delete operations are in `/manage-events` function ([supabase/functions/manage-events/index.ts](supabase/functions/manage-events/index.ts)):

| Action | Requires Admin | PIN Scope | Implementation |
|--------|----------------|-----------|-----------------|
| `delete_event` | Yes | admin | Deletes event (cascades to days, slots, attendance) |
| `delete_day` | Yes | admin | Deletes event day (cascades to slots, attendance) |
| `delete_slot` | Yes | admin | Deletes scan slot (cascades to attendance) |
| `delete_attendance` | Yes | admin | Bulk delete attendance records by IDs |
| `delete_students` (manage-students) | Yes | delete_confirm | Bulk delete students by IDs |

### Current Delete UI Integration
- **Students page** ([src/pages/Students.tsx](src/pages/Students.tsx)): 
  - Select students → triggers `delete_confirm` PIN dialog
  - On success: calls `api.students.delete(ids)`
  
- **Events page** ([src/pages/Events.tsx](src/pages/Events.tsx)):
  - Delete event → triggers `delete_confirm` PIN dialog
  - On success: calls `api.events.deleteEvent(id)`

- **IPC/Export page** ([src/pages/IpcExport.tsx](src/pages/IpcExport.tsx)):
  - Bulk delete students by section → triggers `delete_confirm` PIN dialog

- **Records page** ([src/pages/Records.tsx](src/pages/Records.tsx)):
  - Displays attendance but **NO delete UI currently visible**

### Key Pattern
```typescript
// PIN Dialog invocation pattern
<PinDialog
  open={pinOpen}
  onOpenChange={setPinOpen}
  scope="delete_confirm"  // or "admin"
  title="Confirm Delete"
  description="Enter PIN to..."
  onSuccess={async () => {
    await api.someDeleteFunction(ids);
    toast.success("Deleted");
  }}
/>
```

---

## 4. Supabase Functions Architecture

### Function Organization
All functions in [supabase/functions/](supabase/functions/):

| Function | Purpose | Auth | Endpoint |
|----------|---------|------|----------|
| **verify-pin** | PIN verification, admin/session token issuance | Public | POST /verify-pin |
| **record-attendance** | QR scan submission | Public | POST /record-attendance |
| **lookup-qr** | Student info lookup by student_id | Public (rate-limited) | POST /lookup-qr |
| **get-active-context** | Fetch current event/day/slot context | Public | POST /get-active-context |
| **manage-events** | CRUD events, days, slots, + attendance delete | Admin token required | POST /manage-events |
| **manage-students** | CRUD students, bulk ops | Admin token required | POST /manage-students |
| **update-pins** | Update PIN hashes | Admin token required | POST /update-pins |

### Shared Utilities ([_shared/admin.ts](supabase/functions/_shared/admin.ts))
- `corsHeaders`: CORS configuration
- `issueAdminToken(ttlSeconds)`: Generate HMAC tokens
- `verifyAdminToken(token)`: Validate token and extract claims
- `requireAdmin(req)`: Middleware to check admin token header
- `jsonResponse(body, status)`: Standard response formatter

---

## 5. Where to Add Delete/Reset Attendance Functionality

### Current Code Pointers
1. **Backend**: Deletion logic already exists in `/manage-events` → `delete_attendance` action
   - Takes array of IDs: `const ids = body.ids as string[]`
   - Deletes from `attendance_records` table: `.in("id", ids)`
   - Uses `ON DELETE CASCADE` for cleanup

2. **API Client**: Method exists in [src/lib/api.ts](src/lib/api.ts) line ~135
   ```typescript
   deleteAttendance: (ids: string[]) =>
     invoke<{ ok: boolean }>(
       "manage-events",
       { action: "delete_attendance", ids },
       { admin: true },
     ),
   ```

3. **Frontend UI Patterns**: 
   - [src/components/PinDialog.tsx](src/components/PinDialog.tsx) — Reusable PIN dialog component
   - [src/pages/Records.tsx](src/pages/Records.tsx) — Shows attendance records but **lacks delete UI**
   - [src/pages/Absences.tsx](src/pages/Absences.tsx) — Another potential location for deletion

### Integration Points for Delete Attendance UI

**Option 1: Add to Records page**
- Add checkbox selection (like Students page)
- Add "Delete Selected" button
- Trigger `delete_confirm` PIN dialog
- Call `api.events.deleteAttendance(selectedIds)`

**Option 2: Add to Absences page**
- Similar pattern but filtered to absent students
- Could offer "clear absence" functionality

**Option 3: Add to EventDetail page**
- Manage all attendance for a specific event
- Bulk delete by day/slot

### Hook for Delete Mutation
```typescript
// New hook to add to src/hooks/useAttendance.ts
export function useDeleteAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await api.events.deleteAttendance(ids);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  });
}
```

---

## 6. Key Security & Validation Points

### Server-Side Validation
- **Student lookup**: Checks `status === "enrolled"` before allowing scan
- **Slot validation**: Verifies slot belongs to submitted day
- **Day validation**: Verifies day belongs to submitted event
- **Duplicate prevention**: UNIQUE constraint on (profile_id, slot_id)
- **Late flag**: Computed server-side from `late_cutoff_time`, not client-provided
- **PIN scopes**: Whitelist enforcement (only 5 allowed scopes)

### Rate Limiting
- `/verify-pin`: 8 attempts per 60s per IP
- `/lookup-qr`: 12 attempts per 60s per IP

### RLS (Row-Level Security)
All tables have RLS enabled with public access policies (PIN-gating enforced at application layer):
```sql
CREATE POLICY "public_all_students" ON public.students FOR ALL USING (true)
CREATE POLICY "public_all_attendance" ON public.attendance_records FOR ALL USING (true)
```

---

## 7. Database Relationships & Cascades

```
events (id) 
  ↓ [ON DELETE CASCADE]
event_days (event_id)
  ↓ [ON DELETE CASCADE]
scan_slots (day_id)
  ↓ [ON DELETE CASCADE]
attendance_records (slot_id)

students (id)
  ↓ [referenced by profile_id, no constraint]
attendance_records (profile_id)
```

**Cascade behavior**: Deleting an event cascades through days → slots → attendance records automatically.

---

## 8. Additional Context

### Realtime Updates
- Attendance table subscribed to Supabase realtime ([migrations](supabase/migrations/20260423034915_582395a7-67ca-4840-bd35-bed0c54faf2a.sql))
- Listeners set up in [src/hooks/useAttendance.ts](src/hooks/useAttendance.ts) → `useRealtimeAttendance()`
- Queries auto-invalidate on `postgres_changes` events

### Default PINs
Set in initial migration, stored as bcrypt hashes:
- admin: 47254725
- date_override: 4724685
- delete_confirm: 4725555
- qr_checker: 472005

### App Settings Storage
`app_settings` table stores configuration:
- `pins_hashed` — JSONB map of scope → bcrypt hash
- `active_scan_context` — Current event/day/slot for all connected scanners (broadcast via realtime)

---

## Summary: Integration Path for Delete Attendance

1. **UI Layer**: Add checkbox selection + delete button to Records or Absences page
2. **Component Layer**: Use existing `PinDialog` component with `delete_confirm` scope
3. **Hook Layer**: Add `useDeleteAttendance()` hook (already have the API method)
4. **Backend**: Already implemented (`delete_attendance` action in manage-events)
5. **Database**: Cleanup handled automatically by existing RLS and realtime
