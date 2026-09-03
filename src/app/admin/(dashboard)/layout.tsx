import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { LogoutButton } from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();

  if (!admin) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/rsv-logo.jpg" alt="RSV Hochschwarzwald e.V." className="h-8 w-auto" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Weltcup 2026 · Admin</p>
              <nav className="mt-1 flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                <Link href="/admin" className="hover:text-brand-700">Übersicht</Link>
                <Link href="/admin/helfer" className="hover:text-brand-700">Helfer &amp; Schichten</Link>
                <Link href="/admin/druck" className="hover:text-brand-700">Druckansicht</Link>
                {admin.role === "admin" && (
                  <Link href="/admin/einstellungen" className="hover:text-brand-700">Einstellungen</Link>
                )}
              </nav>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{admin.email} · {admin.role === "admin" ? "Administrator" : "Betrachter"}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
