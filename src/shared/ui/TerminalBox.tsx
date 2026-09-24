import type { ReactNode } from "react";

interface TerminalBoxProps {
  title: ReactNode;
  status?: ReactNode;
  tone?: "green" | "magenta";
  wide?: boolean;
  children: ReactNode;
}

export function TerminalBox({ title, status, tone = "green", wide, children }: TerminalBoxProps) {
  const className = ["term", tone === "magenta" && "term--magenta", wide && "term--wide"].filter(Boolean).join(" ");

  return (
    <section className={className}>
      <h2 className="term__title">{title}</h2>
      {children}
      {status && <div className="term__status">{status}</div>}
    </section>
  );
}
