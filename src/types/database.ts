export type ShiftStatus = "open" | "closed" | "cancelled";
export type RegistrationStatus = "active" | "cancelled" | "waitlist";
export type AdminRole = "admin" | "viewer";

export interface EventRow {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  active: boolean;
  registration_deadline: string | null;
  archived: boolean;
  created_at: string;
}

export interface ShiftRow {
  id: string;
  event_id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: ShiftStatus;
  manually_locked: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ShiftPublicStatus {
  shift_id: string;
  event_id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  status: ShiftStatus;
  manually_locked: boolean;
  sort_order: number;
  active_count: number;
  available_count: number;
  is_full: boolean;
  waitlist_count: number;
  first_names: string[];
}

export interface HelperRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  edit_token: string;
  created_at: string;
  updated_at: string;
}

export interface RegistrationRow {
  id: string;
  helper_id: string;
  shift_id: string;
  status: RegistrationStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegistrationWithHelper extends RegistrationRow {
  helper: HelperRow;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  role: AdminRole;
  created_at: string;
}

export interface TokenRegistrationEntry {
  registration_id: string;
  status: RegistrationStatus;
  shift_id: string;
  date: string;
  name: string;
  start_time: string;
  end_time: string;
  created_at: string;
}

export interface TokenHelperInfo {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface TokenLookupResult {
  success: boolean;
  error?: string;
  helper?: TokenHelperInfo;
  registrations?: TokenRegistrationEntry[];
}

/** Client-facing (public) shift with contact-free display data. */
export interface PublicShift {
  shiftId: string;
  date: string;
  dayLabel: string;
  name: string;
  startTime: string;
  endTime: string;
  capacity: number;
  activeCount: number;
  availableCount: number;
  isFull: boolean;
  isLocked: boolean;
  isBookable: boolean;
  waitlistCount: number;
  waitlistEnabled: boolean;
  firstNames: string[];
}
