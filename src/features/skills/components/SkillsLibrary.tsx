"use client";

import { useState } from "react";
import { errorMessage, revalidate } from "@/shared/api";
import { formatRelative } from "@/shared/format";
import { ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import { SKILL_LIMIT, deleteSkill, type Skill } from "../api";

interface SkillsLibraryProps {
  skills: Skill[] | undefined;
  loading: boolean;
  error: unknown;
  reload: () => void;
  dirty: boolean;
  onEdit: (skill: Skill) => void;
}

export function SkillsLibrary({ skills, loading, error, reload, dirty, onEdit }: SkillsLibraryProps) {
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const needle = query.trim().toLowerCase();
  const shown = skills?.filter((skill) => !needle || skill.name.includes(needle) || skill.description.toLowerCase().includes(needle));

  async function remove(name: string) {
    setFeedback(null);
    try {
      await deleteSkill(name);
      setFeedback({ error: false, message: `Skill "${name}" eliminada.` });
      await revalidate("skills");
    } catch (err) {
      setFeedback({ error: true, message: errorMessage(err) });
    }
  }

  return (
    <TerminalBox wide title="BIBLIOTECA DE SKILLS" status={skills ? `${skills.length} de ${SKILL_LIMIT}` : undefined}>
      <div className="stack">
        {error ? (
          <p className="alert alert--error" role="alert">
            ! {errorMessage(error)}{" "}
            <button type="button" className="linkbtn" onClick={reload}>
              reintentar
            </button>
          </p>
        ) : null}
        {feedback && (
          <p className={`alert alert--${feedback.error ? "error" : "ok"}`} role={feedback.error ? "alert" : "status"}>
            {feedback.message}
          </p>
        )}
        {skills && skills.length > 0 && (
          <label className="field">
            Buscar skill
            <input className="field__input" type="search" placeholder="Buscar por nombre o descripción…" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        )}
        {loading ? (
          <p className="empty">
            <Spinner /> cargando skills
          </p>
        ) : !skills?.length ? (
          <p className="empty">Todavía no hay skills. Crea una con el agente o sube un archivo .md.</p>
        ) : !shown?.length ? (
          <p className="empty">No hay skills que coincidan con la búsqueda.</p>
        ) : (
          <ul className="rail skill-library">
            {shown.map((skill) => (
              <li key={skill.id} className="rail__item">
                <span className="rail__glyph" aria-hidden="true">◇</span>
                <span className="rail__title">{skill.name}</span>
                <span className="status">{formatRelative(skill.updatedAt)}</span>
                <span className="rail__meta rail__meta--actions">
                  <span>{skill.description || "sin descripción"}</span>
                  <span className="rail__actions">
                    {dirty ? (
                      <ConfirmButton question="¿Descartar el borrador?" onConfirm={() => onEdit(skill)}>
                        editar
                      </ConfirmButton>
                    ) : (
                      <button type="button" className="linkbtn" onClick={() => onEdit(skill)}>
                        editar
                      </button>
                    )}
                    <ConfirmButton question={`¿Eliminar ${skill.name}?`} onConfirm={() => remove(skill.name)}>
                      eliminar
                    </ConfirmButton>
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}
