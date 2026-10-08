import { CxDashboard } from "@/features/cx-dashboard";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function CxPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash cx-page">
        <PageHeader
          kicker="NEGOCIO :: MI CX"
          title="mi cx"
          description="leads, conversaciones sin contestar, pipeline, ventas y citas de tu cuenta del CX."
        />
        <CxDashboard />
      </div>
    </RequireRole>
  );
}
