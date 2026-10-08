import { OrganizationSettings } from "@/features/organization";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function OrganizationPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash organization-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: AJUSTES"
          title="organización"
          description="nombre, asientos, almacenamiento, proyectos sin dueño, uso de IA y propiedad."
        />
        <OrganizationSettings />
      </div>
    </RequireRole>
  );
}
