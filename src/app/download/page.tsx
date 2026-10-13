import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { listInstallers, platformOf, type Installer, type Platform } from "@/features/downloads/server";
import { AuthShell, TerminalBox } from "@/shared/ui";

// Public: no session needed (middleware.ts protects only the console's pages). Rendered
// per request, so a newly published installer shows up without a rebuild.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Descargar · THE WAY",
  description: "Descarga THE WAY Desktop para Windows o macOS.",
};

// The installers are not code-signed, so each system warns once before the first run.
const STEPS: Record<Platform, { heading: string; steps: ReactNode[] }> = {
  windows: {
    heading: "Instalar en Windows",
    steps: [
      "Abre THE-WAY-Setup.exe desde tus descargas.",
      "Si aparece «Windows protegió su PC», pulsa Más información y después Ejecutar de todas formas.",
      "Se instala solo, sin permisos de administrador, y abre la app. Inicia sesión con tu cuenta.",
    ],
  },
  mac: {
    heading: "Instalar en macOS",
    steps: [
      "Abre THE-WAY-mac.zip y arrastra THE WAY a Aplicaciones.",
      "Ábrela. Si macOS la bloquea, ve a Ajustes del Sistema › Privacidad y seguridad y pulsa Abrir igualmente.",
      <>Si dice que la app «está dañada», ejecuta en Terminal <code className="download__code">xattr -cr "/Applications/THE WAY.app"</code> y ábrela de nuevo.</>,
    ],
  },
};

function details(installer: Installer) {
  if (!installer.available) return "Aún no publicado";
  const parts = [];
  if (installer.sizeBytes) parts.push(`${Math.round(installer.sizeBytes / 1_000_000)} MB`);
  if (installer.updatedAt) {
    parts.push(`Actualizado ${new Date(installer.updatedAt).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}`);
  }
  return parts.join(" · ") || "Disponible";
}

export default async function DownloadPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [installers, query, requestHeaders] = await Promise.all([listInstallers(), searchParams, headers()]);
  const recommended = platformOf(requestHeaders.get("user-agent") ?? "");
  const missing = query.missing ? installers?.find((i) => i.platform === query.missing)?.label ?? query.missing : null;

  return (
    <AuthShell>
      <div className="download">
        <header className="download__intro">
          <h1 className="download__title">THE WAY Desktop</h1>
          <p className="download__lead">La app de escritorio para operadores: chatea con el agente, comparte archivos de tu equipo y aprueba lo que hace en tu nombre.</p>
        </header>

        {installers === null || query.error ? (
          <p className="alert alert--error" role="alert">! No pudimos preparar la descarga. Intenta de nuevo en un momento.</p>
        ) : missing ? (
          <p className="alert alert--error" role="alert">! El instalador para {missing} todavía no está publicado.</p>
        ) : null}

        <div className="download__grid">
          {(installers ?? (["windows", "mac"] as Platform[]).map((platform) => ({ platform, label: platform === "windows" ? "Windows" : "macOS", available: false } as Installer))).map((installer) => (
            <TerminalBox key={installer.platform} title={installer.label.toUpperCase()} status={details(installer)}>
              <div className="stack">
                {recommended === installer.platform && <p className="download__badge">✓ Recomendado para este equipo</p>}
                {installer.available ? (
                  <a className="btn" href={`/download/${installer.platform}`}>Descargar para {installer.label}</a>
                ) : (
                  <button className="btn" type="button" disabled>No disponible</button>
                )}
                <div>
                  <h2 className="download__heading">{STEPS[installer.platform].heading}</h2>
                  <ol className="download__steps">
                    {STEPS[installer.platform].steps.map((step, index) => <li key={index}>{step}</li>)}
                  </ol>
                </div>
              </div>
            </TerminalBox>
          ))}
        </div>

        <p className="switch">
          ¿Administras tu organización? <Link href="/login">Inicia sesión en la consola ❯</Link>
        </p>
      </div>
    </AuthShell>
  );
}
