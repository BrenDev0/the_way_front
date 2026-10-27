import { InvitationsStat } from "@/features/invitations";
import { DocumentsStat, KnowledgeStatus } from "@/features/knowledge";
import { SkillsStat } from "@/features/skills";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AiAccessNotice, Welcome } from "@/shell";
import { ActionOverview } from "@/shell/ActionOverview";

export default function HomePage() {
  return (
    <div className="dash">
      <Welcome />
      <RequireRole roles={ADMIN_ROLES}>
        <AiAccessNotice />
        <ActionOverview />
      </RequireRole>
      <div className="stats">
        <RequireRole roles={ADMIN_ROLES}>
          <DocumentsStat />
          <InvitationsStat />
          <SkillsStat />
        </RequireRole>
      </div>
      <div className="dash__panels">
        <RequireRole roles={ADMIN_ROLES}>
          <KnowledgeStatus />
        </RequireRole>
      </div>
    </div>
  );
}
