import Link from "next/link";

export function AccessDenied() {
  return (
    <div className="dash">
      <p className="alert alert--error" role="alert">
        ! No tienes permisos para ver esta sección. <Link href="/home">volver al inicio ❯</Link>
      </p>
    </div>
  );
}
