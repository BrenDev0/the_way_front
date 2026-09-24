import type { Metadata } from "next";
import type { ReactNode } from "react";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "THE WAY",
  description: "Terminal de acceso a THE WAY",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={mono.variable}>
      <body>{children}</body>
    </html>
  );
}
