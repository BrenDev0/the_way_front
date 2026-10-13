import { LibraryWorkspace } from "@/features/library";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function LibraryPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash library-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: BIBLIOTECA"
          title="Biblioteca de marcas"
          description="Logos, imágenes, fuentes y manuales por cliente. El agente los usa en el chat y nunca los modifica."
        />
        <LibraryWorkspace />
      </div>
    </RequireRole>
  );
}
