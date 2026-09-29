import { LlmKeyNotice } from "@/features/api-keys";
import { SkillsWorkspace } from "@/features/skills";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function SkillsPage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash skills-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: SKILLS"
          title="skills del agente"
          description="instrucciones reutilizables que el agente consulta cuando una tarea coincide. créalas conversando con el agente o sube archivos .md."
        />
        <LlmKeyNotice />
        <SkillsWorkspace />
      </div>
    </RequireRole>
  );
}
