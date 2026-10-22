"use client";

import { useState } from "react";
import { errorMessage, revalidate, useResource } from "@/shared/api";
import { formatRelative } from "@/shared/format";
import { ConfirmButton, Spinner, TerminalBox } from "@/shared/ui";
import { SKILL_LIMIT, deleteSkill, getSkill, type Skill } from "../api";

/** "3 archivos: brief.md · laws.md · verification.md". The list does not carry reference files, so
 *  unless it does, the paths come from the skill itself, fetched once the row asks for them. */
function SkillFiles({ skill }: { skill: Skill }) {
  const listed = skill.files ?? [];
  // Keyed by the update time so an edit or a re-import fetches the paths again.
  const detail = useResource(listed.length ? null : `skills/${skill.name}@${skill.updatedAt}`, () => getSkill(skill.name));
  const files = listed.length ? listed : detail.data ? (detail.data.files ?? []) : undefined;

  let content;
  if (files) {
    content = files.length ? (
      <>
        <span className="skill-library__files-count">
          {files.length} {files.length === 1 ? "archivo" : "archivos"}:
        </span>{" "}
        {files.join(" · ")}
      </>
    ) : (
      "Sin archivos de referencia"
    );
  } else if (detail.error) {
    content = (
      <>
        ! {errorMessage(detail.error)}{" "}
        <button type="button" className="linkbtn" onClick={detail.reload}>
          Reintentar
        </button>
      </>
    );
  } else {
    content = (
      <>
        <Spinner /> Cargando archivos
      </>
    );
  }
  return (
    <span className="skill-library__files">
      {content}
    </span>
  );
}

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
  // Skills whose reference files were asked for, by opening them or with "archivos".
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const needle = query.trim().toLowerCase();
  const shown = skills?.filter((skill) => !needle || skill.name.includes(needle) || skill.description.toLowerCase().includes(needle));

  function showFiles(name: string) {
    setOpened((current) => (current.has(name) ? current : new Set(current).add(name)));
  }

  function edit(skill: Skill) {
    showFiles(skill.name);
    onEdit(skill);
  }

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
              Reintentar
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
            <Spinner /> Cargando skills
          </p>
        ) : !skills?.length ? (
          <p className="empty">Todavía no hay skills. Crea una con AGENTIX o sube un archivo .md.</p>
        ) : !shown?.length ? (
          <p className="empty">No hay skills que coincidan con la búsqueda.</p>
        ) : (
          <ul className="rail skill-library">
            {shown.map((skill) => {
              const filesShown = opened.has(skill.name) || Boolean(skill.files?.length);
              return (
                <li key={skill.id} className="rail__item">
                  <span className="rail__glyph" aria-hidden="true">◇</span>
                  <span className="rail__title">{skill.name}</span>
                  <span className="status">{formatRelative(skill.updatedAt)}</span>
                  <span className="rail__meta rail__meta--actions">
                    <span>{skill.description || "Sin descripción"}</span>
                    <span className="rail__actions">
                      {!filesShown && (
                        <button type="button" className="linkbtn" onClick={() => showFiles(skill.name)}>
                          Archivos
                        </button>
                      )}
                      {dirty ? (
                        <ConfirmButton question="¿Descartar el borrador?" onConfirm={() => edit(skill)}>
                          Editar
                        </ConfirmButton>
                      ) : (
                        <button type="button" className="linkbtn" onClick={() => edit(skill)}>
                          Editar
                        </button>
                      )}
                      <ConfirmButton question={`¿Eliminar ${skill.name}?`} onConfirm={() => remove(skill.name)}>
                        Eliminar
                      </ConfirmButton>
                    </span>
                  </span>
                  {filesShown && <SkillFiles skill={skill} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </TerminalBox>
  );
}
