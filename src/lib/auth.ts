import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AdminRole } from "@/types/database";

export interface CurrentAdmin {
  userId: string;
  email: string | null;
  role: AdminRole;
  displayName: string | null;
}

/**
 * Liest die aktuelle Session + zugehörige Rolle aus "profiles".
 * Gibt null zurück, wenn kein eingeloggter/berechtigter Benutzer vorliegt.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    userId: user.id,
    email: user.email ?? null,
    role: profile.role as AdminRole,
    displayName: profile.display_name,
  };
}

export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) {
    throw new AuthError("unauthorized");
  }
  return admin;
}

export async function requireRole(role: AdminRole): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (role === "admin" && admin.role !== "admin") {
    throw new AuthError("forbidden");
  }
  return admin;
}

export class AuthError extends Error {
  constructor(public code: "unauthorized" | "forbidden") {
    super(code);
  }
}
