import type { ReactNode } from "react";
import { Scramble } from "./Scramble";

interface PageHeaderProps {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
}

export function PageHeader({ kicker, title, description }: PageHeaderProps) {
  return (
    <header className="welcome">
      <p className="welcome__kicker">
        <Scramble text={kicker} />
      </p>
      <h1 className="welcome__title">{title}</h1>
      {description && <p className="welcome__org">{description}</p>}
    </header>
  );
}
