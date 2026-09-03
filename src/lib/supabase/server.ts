import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-Client für Server Components / Route Handlers, gebunden an
 * die Session-Cookies des eingeloggten Admin-Benutzers. Nutzt weiterhin
 * den anon-Key + RLS – die Rolle des Benutzers wird über die
 * "profiles"-Tabelle geprüft (siehe src/lib/auth.ts).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options ?? {});
            });
          } catch {
            // Wird in Server Components ohne Response-Objekt aufgerufen
            // (Cookies können dort nicht gesetzt werden). Server Actions und
            // Route Handlers (z. B. Login/Logout, admin/actions.ts) laufen
            // mit Response-Objekt und aktualisieren die Session dort normal.
          }
        },
      },
    }
  );
}
