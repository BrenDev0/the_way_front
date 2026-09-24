import type { ReactNode } from "react";
import { Logo } from "./Logo";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <div className="brand">
        <Logo />
        <div className="byline">BY XPLORERS</div>
      </div>
      {children}
      <p className="footer">the way · v0.1</p>
    </main>
  );
}
