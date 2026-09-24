"use client";

import type { CSSProperties } from "react";
import { useDocuments } from "../hooks";

export function KnowledgeOverview() {
  const { data, loading, error } = useDocuments();
  const total = data?.length ?? 0;
  const ready = data?.filter((doc) => doc.status === "extracted").length ?? 0;
  const trained = data?.filter((doc) => doc.status === "trained").length ?? 0;
  const progress = total > 0 ? Math.round((trained / total) * 100) : 0;
  const unavailable = !data && Boolean(error);

  return (
    <section className="knowledge-overview" aria-labelledby="knowledge-overview-title">
      <div className="knowledge-overview__main">
        <div className="knowledge-overview__copy">
          <p className="knowledge-overview__eyebrow">
            <span className="knowledge-overview__signal" aria-hidden="true" />
            IDENTIDAD / CONTEXTO COMPARTIDO
          </p>
          <h2 id="knowledge-overview-title">La memoria de tu organización.</h2>
          <p>Reúne quiénes son, qué ofrecen y cómo trabajan. Una vez entrenadas, el agente puede consultar estas fuentes para ayudar a todo el equipo.</p>
          <div className="knowledge-overview__tags" aria-label="Ejemplos de conocimiento compartido">
            <span>IDENTIDAD</span>
            <span>PROCESOS</span>
            <span>SERVICIOS</span>
          </div>
        </div>
        <div
          className="knowledge-overview__dial"
          style={{ "--knowledge-progress": `${progress}%` } as CSSProperties}
          aria-label={loading ? "Cargando progreso" : unavailable ? "Progreso no disponible" : `${trained} de ${total} documentos entrenados`}
        >
          <div className="knowledge-overview__dial-inner">
            <span className="knowledge-overview__dial-value">{loading || unavailable ? "--" : String(trained).padStart(2, "0")}</span>
            <span className="knowledge-overview__dial-label">DISPONIBLES</span>
          </div>
        </div>
      </div>
      <div className="knowledge-overview__flow">
        <div>
          <span className="knowledge-overview__flow-label">FUENTES COMPARTIDAS</span>
          <strong>{loading || unavailable ? "--" : String(total).padStart(2, "0")}</strong>
          <span className="knowledge-overview__flow-note">de la organización</span>
        </div>
        <div>
          <span className="knowledge-overview__flow-label">LISTAS PARA ENTRENAR</span>
          <strong>{loading || unavailable ? "--" : String(ready).padStart(2, "0")}</strong>
          <span className="knowledge-overview__flow-note">fuentes preparadas</span>
        </div>
        <div>
          <span className="knowledge-overview__flow-label">DISPONIBLES PARA EL AGENTE</span>
          <strong>{loading || unavailable ? "--" : String(trained).padStart(2, "0")}</strong>
          <span className="knowledge-overview__flow-note">en el contexto compartido</span>
        </div>
      </div>
    </section>
  );
}
