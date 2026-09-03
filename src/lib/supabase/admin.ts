import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-Role-Client. Umgeht RLS vollständig – DARF NIEMALS in
 * Client-Code, API-Antworten oder das Browser-Bundle gelangen.
 * Ausschließlich in Route Handlers / Server-only Modulen verwenden,
 * die selbst zuvor die Admin-Rolle geprüft haben (siehe src/lib/auth.ts).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY oder NEXT_PUBLIC_SUPABASE_URL fehlt in den Environment Variables."
    );
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
