import { SkillsWorkspace } from "@/features/skills";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";
import { AiAccessNotice } from "@/shell";

export default function SkillsPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash skills-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: SKILLS"
          title="Skills de AGENTIX"
          description="Instrucciones reutilizables que AGENTIX consulta cuando una tarea coincide. Créalas conversando con AGENTIX o sube archivos .md."
        />
        <AiAccessNotice />
        <SkillsWorkspace />
      </div>
    </RequireRole>
  );
}
