import { ApiKeysManager } from "@/features/api-keys/components/ApiKeysManager";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default async function ApiKeysPage({ searchParams }: { searchParams: Promise<{ userId?: string | string[] }> }) {
  const { userId } = await searchParams;
  return <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
    <div className="dash">
      <PageHeader kicker="ORGANIZACIÓN :: ACCESO" title="llaves api" description="Configura los proveedores que necesita cada persona del equipo." />
      <ApiKeysManager initialUserId={typeof userId === "string" ? userId : undefined} />
    </div>
  </RequireRole>;
}
