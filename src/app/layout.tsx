import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import "./theme.css";
import "./globals.css";
import "./console.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-face", display: "swap" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans-face", display: "swap" });

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
