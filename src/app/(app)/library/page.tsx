import { LibraryWorkspace } from "@/features/library";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function LibraryPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash library-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: BIBLIOTECA"
          title="biblioteca de marcas"
          description="logos, imágenes, fuentes y manuales por cliente. el agente los usa en el chat y nunca los modifica."
        />
        <LibraryWorkspace />
      </div>
    </RequireRole>
  );
}
