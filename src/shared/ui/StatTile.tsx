import type { ReactNode } from "react";
import { Spinner } from "./Spinner";

interface StatTileProps {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  loading?: boolean;
  failed?: boolean;
}

export function StatTile({ label, value, detail, loading, failed }: StatTileProps) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{loading ? <Spinner /> : failed ? <span className="stat__failed">--</span> : value}</div>
      <div className="stat__detail">{failed ? "no disponible" : loading ? "cargando" : detail}</div>
    </div>
  );
}
