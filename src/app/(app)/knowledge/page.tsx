import { DocumentUploader, DocumentsTable, KnowledgeOverview } from "@/features/knowledge";
import { ADMIN_ROLES, RequireRole } from "@/shared/session";
import { AccessDenied, PageHeader } from "@/shared/ui";

export default function KnowledgePage() {
  return (
    <RequireRole roles={ADMIN_ROLES} fallback={<AccessDenied />}>
      <div className="dash knowledge-page">
        <PageHeader
          kicker="ORGANIZACIÓN :: CONOCIMIENTO"
          title="conocimiento de la organización"
          description="la referencia compartida que ayuda al agente a apoyar a todo el equipo."
        />
        <KnowledgeOverview />
        <DocumentUploader />
        <DocumentsTable />
      </div>
    </RequireRole>
  );
}
