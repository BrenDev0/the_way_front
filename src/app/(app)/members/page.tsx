import { InviteForm, PendingInvitations } from "@/features/invitations";
import { MembersList } from "@/features/members";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function MembersPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash">
        <PageHeader
          kicker="ORGANIZACIÓN :: OPERADORES"
          title="operadores"
          description="consulta quién tiene acceso e invita nuevos operadores a tu organización."
        />
        <MembersList />
        <div className="dash__panels">
          <InviteForm />
          <PendingInvitations />
        </div>
      </div>
    </RequireRole>
  );
}
