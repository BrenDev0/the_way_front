import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import "./theme.css";
import "./globals.css";
import "./console.css";

// Self-hosted from the @fontsource packages, not fetched from Google at build time: the build
// then needs no network, and a change in what Google serves (its font links lost their file
// extension, which broke next/font/google's loader) cannot break it. Latin covers Spanish.
const mono = localFont({
  src: "../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-mono-face",
  display: "swap",
});
const sans = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: "THE WAY",
  description: "Terminal de acceso a THE WAY",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${mono.variable} ${sans.variable}`} data-effects="calm">
      <body>{children}</body>
    </html>
  );
}
