import "./globals.css";
import type { Metadata } from "next";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserWithRole } from "@/lib/auth";
import { MODULE_IDS } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { hslString, pickForeground } from "@/lib/colors";
import { CsrfTokenField } from "@/components/ui/csrf-token-field";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Gestion des Taxes",
  description: "Plateforme de gestion des taxes municipales",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isLoginPage = pathname.startsWith("/login");
  const isPrintPage = pathname.includes("/assessments/") && pathname.endsWith("/print");
  const settings = await prisma.appSetting.findFirst();

  if (isLoginPage) {
    return (
      <html lang="fr">
        <body className={`${plexSans.variable} ${spaceGrotesk.variable} min-h-screen text-foreground`}>
          <div className="min-h-screen bg-[#006c50]">
            <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-8 px-6 py-10">
              <div className="w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-2xl">
                <div className="text-center">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Commune</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900 font-display">
                    {settings?.municipalityName ?? "Gestion des Taxes"}
                  </div>
                  {settings?.municipalityLogo ? (
                    <div className="mt-4 flex items-center justify-center">
                      <img
                        src={settings.municipalityLogo}
                        alt="Logo commune"
                        className="h-20 w-auto rounded-md"
                      />
                    </div>
                  ) : null}
                </div>
                <div className="mt-6">{children}</div>
              </div>
            </main>
          </div>
        </body>
      </html>
    );
  }

  if (isPrintPage) {
    return (
      <html lang="fr">
        <body className={`${plexSans.variable} ${spaceGrotesk.variable} min-h-screen text-foreground`}>
          <main className="min-h-screen bg-white">{children}</main>
        </body>
      </html>
    );
  }

  const user = await getUserWithRole();
  if (!user) {
    redirect("/login");
  }
  const hasSubordinates = (await prisma.user.count({ where: { supervisorId: user.id } })) > 0;
  const enabledModules = user.role === "SUPER_ADMIN" ? MODULE_IDS : user.enabledModules ?? MODULE_IDS;
  const enabled = new Set(enabledModules);
  const showSettingsSection =
    enabled.has("settings") || enabled.has("user-management") || enabled.has("global-calculation");
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";

  const moduleRouteMap: Array<{ id: string; paths: string[]; fallback: string }> = [
    { id: "dashboard", paths: ["/dashboard"], fallback: "/dashboard" },
    { id: "map", paths: ["/map"], fallback: "/map" },
    { id: "taxpayers", paths: ["/taxpayers"], fallback: "/taxpayers" },
    { id: "reductions", paths: ["/reductions"], fallback: "/reductions" },
    { id: "collections", paths: ["/collections", "/assessments"], fallback: "/collections/due" },
    { id: "collectors", paths: ["/collectors"], fallback: "/collectors" },
    { id: "payments", paths: ["/payments"], fallback: "/payments" },
    { id: "reports", paths: ["/reports"], fallback: "/reports" },
    { id: "audit", paths: ["/audit"], fallback: "/audit" },
    { id: "logs", paths: ["/logs"], fallback: "/logs" },
    { id: "user-management", paths: ["/admin/users", "/admin/roles"], fallback: "/admin/users" },
    {
      id: "global-calculation",
      paths: ["/admin/settings/calculations"],
      fallback: "/admin/settings/calculations",
    },
    {
      id: "settings",
      paths: ["/taxes", "/collectors", "/import", "/admin", "/admin/settings", "/collections/api-logs"],
      fallback: "/admin/settings",
    },
  ];

  if (!isAdmin && pathname) {
    const moduleForPath = moduleRouteMap.find((entry) =>
      entry.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
    );
    if (moduleForPath && !enabled.has(moduleForPath.id)) {
      const allowed = moduleRouteMap.find((entry) => enabled.has(entry.id)) ?? moduleRouteMap[0];
      redirect(allowed.fallback);
    }
  }
  const theme = {
    primary: settings?.primaryColor ?? "#0f172a",
    background: settings?.backgroundColor ?? "#ffffff",
    foreground: settings?.foregroundColor ?? "#0f172a",
    muted: settings?.mutedColor ?? "#f1f5f9",
    border: settings?.borderColor ?? "#e2e8f0",
  };

  return (
    <html lang="fr">
      <body
        className={`${plexSans.variable} ${spaceGrotesk.variable} min-h-screen text-foreground`}
        style={{
          ["--primary" as any]: hslString(theme.primary, "222 47% 11%"),
          ["--primary-foreground" as any]: pickForeground(theme.primary),
          ["--background" as any]: hslString(theme.background, "0 0% 100%"),
          ["--foreground" as any]: hslString(theme.foreground, "222 47% 11%"),
          ["--muted" as any]: hslString(theme.muted, "210 40% 96%"),
          ["--border" as any]: hslString(theme.border, "214 32% 91%"),
        }}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f7f1e8,_#fefdfb_45%,_#eef3f7)]">
          <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-6 lg:flex-row">
            <aside className="w-full shrink-0 lg:w-72">
              <div className="space-y-6 lg:sticky lg:top-6">
                <div className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
                  <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">Plateforme</div>
                  <div className="mt-2 text-center text-2xl font-semibold text-slate-900 font-display">
                    {settings?.municipalityName ?? "Gestion des Taxes"}
                  </div>
                  {settings?.municipalityLogo ? (
                    <div className="mt-4 flex items-center justify-center">
                      <img
                        src={settings.municipalityLogo}
                        alt="Logo commune"
                        className="h-24 w-auto rounded-md"
                      />
                    </div>
                  ) : null}
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-600">
                    <span>Connecte {user.name ?? user.email}</span>
                    <form action="/api/auth/logout" method="post">
                      <CsrfTokenField />
                      <button type="submit" className="rounded-full border border-slate-200 p-1 hover:bg-slate-50">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5 text-slate-600"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M10 17l5-5-5-5" />
                          <path d="M15 12H3" />
                          <path d="M21 21V3" />
                        </svg>
                      </button>
                    </form>
                  </div>
                  <p className="mt-2 text-center text-xs text-muted-foreground">Municipal - sécurisée et traçable</p>
                </div>
                <nav className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Menu
                  </div>
                  <div className="flex flex-col gap-2 text-[15px]">
                    {enabled.has("dashboard") && (
                      <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/dashboard">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 12h7V3H3zM14 21h7v-7h-7zM14 3h7v7h-7zM3 14h7v7H3z" />
                        </svg>
                        Dashboard
                      </a>
                    )}
                    {enabled.has("map") && (
                      <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/map">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
                          <path d="M9 4v14M15 6v14" />
                        </svg>
                        Carte des contribuables
                      </a>
                    )}
                    {enabled.has("taxpayers") && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M16 11a4 4 0 1 0-8 0" />
                            <path d="M2 20a8 8 0 0 1 20 0" />
                            <circle cx="12" cy="7" r="3" />
                          </svg>
                          Contribuables
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          <Link className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/taxpayers">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            Liste
                          </Link>
                          <Link className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/taxpayers/new">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 5v14M5 12h14" />
                            </svg>
                            Ajouter
                          </Link>
                          <Link className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/taxpayers/groups">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="8" cy="8" r="3" />
                              <circle cx="16" cy="8" r="3" />
                              <path d="M2 20c1-3 4-5 6-5s5 2 6 5" />
                              <path d="M10 20c1-3 4-5 6-5s5 2 6 5" />
                            </svg>
                            Groupes
                          </Link>
                        </div>
                      </details>
                    )}
                    {enabled.has("collections") && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 12h18" />
                            <path d="M7 8h10M7 16h10" />
                            <path d="M5 4h14v16H5z" />
                          </svg>
                          Recouvrements d&apos;impôts
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/collections/due">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 12h8" />
                            </svg>
                            Taxes dues
                          </a>
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/collections/partial">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 12h8M8 16h4" />
                            </svg>
                            Taxes partiellement payées
                          </a>
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/collections/paid">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v16H4z" />
                              <path d="m9 12 2 2 4-4" />
                            </svg>
                            Taxes perçues
                          </a>
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/assessments">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 2h9l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                              <path d="M14 2v4h4" />
                              <path d="M8 12h8M8 16h6" />
                            </svg>
                            Avis d&apos;imposition
                          </a>
                        </div>
                      </details>
                    )}
                    {enabled.has("payments") && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 6h16M4 12h16M4 18h10" />
                            <path d="M16 16l2 2 3-3" />
                          </svg>
                          Paiements
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/payments">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M7 12h10M9 18h6" />
                            </svg>
                            Faire un encaissement
                          </a>
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/payments/history">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 12h8" />
                              <path d="M8 16h6" />
                            </svg>
                            Mes encaissements
                          </a>
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/payments/reports">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v16H4z" />
                              <path d="M8 16V8m4 8V6m4 10V10" />
                            </svg>
                            Mon rapport
                          </a>
                        </div>
                      </details>
                    )}
                    {enabled.has("collectors") && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M6 3h12M6 11h12" />
                          </svg>
                          Collecteurs & API
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/collections/api-logs">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16v6H4z" />
                              <path d="M4 14h16v6H4z" />
                              <path d="M8 7h4M8 17h6" />
                            </svg>
                            Journal API
                          </a>
                        </div>
                      </details>
                    )}
                    {enabled.has("reductions") && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 3v6" />
                            <path d="M6 9h12" />
                            <path d="M5 21h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2z" />
                          </svg>
                          Reductions
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/reductions">
                            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 6h16M4 12h12M4 18h10" />
                            </svg>
                            Mes demandes
                          </a>
                          {hasSubordinates && (
                            <a
                              className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white"
                              href="/reductions/approvals"
                            >
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4" />
                                <path d="M5 4h14v16H5z" />
                              </svg>
                              Demandes a approuver
                            </a>
                          )}
                        </div>
                      </details>
                    )}
                    {enabled.has("reports") && (
                      <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/reports">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h16v16H4z" />
                          <path d="M8 16V8m4 8V6m4 10V10" />
                        </svg>
                        Rapports
                      </a>
                    )}
                    {enabled.has("audit") && (
                      <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/audit">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="7" />
                          <path d="M21 21l-4.3-4.3" />
                        </svg>
                        Audit
                      </a>
                    )}
                    {enabled.has("logs") && (
                      <a className="flex items-center gap-2 rounded-lg px-3 py-2 text-slate-700 hover:bg-slate-100" href="/logs">
                        <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4h12v16H4z" />
                          <path d="M8 8h4M8 12h6M8 16h6" />
                          <path d="M16 8h4v12h-4z" />
                        </svg>
                        Journal d&apos;activites
                      </a>
                    )}
                    {showSettingsSection && (
                      <details open className="rounded-xl border border-emerald-100/70 bg-emerald-50/60 px-3 py-2">
                        <summary className="flex cursor-pointer items-center gap-2 text-slate-900">
                          <svg viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 1v4M12 19v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M1 12h4M19 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Paramétrage
                        </summary>
                        <div className="mt-2 flex flex-col gap-1 text-[13px] text-slate-700">
                          {enabled.has("settings") && (
                            <>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/taxes">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 7h16M6 3h12M6 11h12" />
                                </svg>
                                Taxes
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/taxes/rules">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 4h16v4H4zM4 12h16v8H4z" />
                                </svg>
                                Règles
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/import">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 3v12" />
                                  <path d="m7 8 5-5 5 5" />
                                  <path d="M4 21h16" />
                                </svg>
                                Importation
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/collectors">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="8" cy="8" r="3" />
                                  <circle cx="16" cy="8" r="3" />
                                  <path d="M2 20c1-3 4-5 6-5s5 2 6 5" />
                                  <path d="M10 20c1-3 4-5 6-5s5 2 6 5" />
                                </svg>
                                Collecteurs
                              </a>
                            </>
                          )}
                          {enabled.has("user-management") && (
                            <>
                              <Link className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/users">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="9" cy="7" r="3" />
                                  <path d="M2 20c1-4 5-6 7-6s6 2 7 6" />
                                  <path d="M16 11h6" />
                                </svg>
                                Utilisateurs
                              </Link>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/roles">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 2l7 4v6c0 5-4 8-7 10-3-2-7-5-7-10V6z" />
                                </svg>
                                Rôles & RBAC
                              </a>
                            </>
                          )}
                          {enabled.has("settings") && (
                            <>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="3" />
                                  <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
                                </svg>
                                Paramètres généraux
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/assessments">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M6 2h9l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
                                  <path d="M14 2v4h4" />
                                  <path d="M8 12h8M8 16h6" />
                                </svg>
                                Avis d&apos;imposition
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/categories">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 4h16v6H4zM4 14h7v6H4zM13 14h7v6h-7z" />
                                </svg>
                                Catégories
                              </a>
                            </>
                          )}
                          {enabled.has("global-calculation") && (
                            <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/calculations">
                              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M4 4h16v16H4z" />
                                <path d="M8 8h8M8 12h5M8 16h3" />
                              </svg>
                              Calcul global
                            </a>
                          )}
                          {enabled.has("settings") && (
                            <>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/communes">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 20h18" />
                                  <path d="M5 20V9l7-4 7 4v11" />
                                  <path d="M9 20v-6h6v6" />
                                </svg>
                                Communes
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/neighborhoods">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 10l9-6 9 6" />
                                  <path d="M5 10v10h14V10" />
                                  <path d="M9 20v-6h6v6" />
                                </svg>
                                Quartiers
                              </a>
                              <a className="flex items-center gap-2 rounded-md bg-white/80 px-2 py-1 shadow-sm hover:bg-white" href="/admin/settings/api-logs">
                                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M4 4h16v6H4z" />
                                  <path d="M4 14h16v6H4z" />
                                  <path d="M8 7h4M8 17h6" />
                                </svg>
                                Journal API
                              </a>
                            </>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </nav>
                <div className="rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Raccourcis</div>
                  <div className="mt-3 flex flex-col gap-2 text-sm text-slate-700">
                    {enabled.has("collections") && (
                      <a className="rounded-lg border border-dashed px-3 py-2 hover:bg-slate-50" href="/collections/due">
                        + Suivre les taxes dues
                      </a>
                    )}
                    <form action="/api/auth/logout" method="post">
                      <CsrfTokenField />
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-dashed px-3 py-2 text-left hover:bg-slate-50"
                      >
                        Se deconnecter
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </aside>
            <main className="flex-1 rounded-3xl border border-border/60 bg-white/80 p-6 shadow-sm backdrop-blur">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
