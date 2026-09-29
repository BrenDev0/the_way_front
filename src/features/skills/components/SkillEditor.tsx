"use client";

import { useState } from "react";
import { errorMessage, revalidate } from "@/shared/api";
import { Busy, ConfirmButton, TerminalBox } from "@/shared/ui";
import { saveSkill, type Skill } from "../api";
import { MAX_DESCRIPTION_CHARS, draftProblem, parseSkill } from "../draft";

const TEMPLATE = "---\nname: \ndescription: \n---\n\n";

interface SkillEditorProps {
  draft: string;
  dirty: boolean;
  skills: Skill[] | undefined;
  onChange: (content: string) => void;
  onSaved: (content: string) => void;
}

export function SkillEditor({ draft, dirty, skills, onChange, onSaved }: SkillEditorProps) {
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const parsed = parseSkill(draft);
  const problem = draft.trim() ? draftProblem(parsed) : null;
  const name = parsed.name?.toLowerCase();
  const replacing = Boolean(name && skills?.some((skill) => skill.name === name));

  async function save() {
    if (saving || problem || !draft.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const skill = await saveSkill({ instructions: draft });
      setFeedback({ error: false, message: `Skill "${skill.name}" guardada. El agente ya puede usarla.` });
      onSaved(draft);
      await revalidate("skills");
    } catch (err) {
      setFeedback({ error: true, message: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <TerminalBox wide title="02 / BORRADOR" status={dirty ? "cambios sin guardar" : draft.trim() ? "sin cambios" : "vacío"}>
      <div className="stack skill-editor">
        <div className="skill-editor__meta">
          <span>
            <span className="console-section-label">NOMBRE</span>
            <strong>{parsed.name || "—"}</strong>
          </span>
          <span>
            <span className="console-section-label">DESCRIPCIÓN · {(parsed.description ?? "").length}/{MAX_DESCRIPTION_CHARS}</span>
            <span>{parsed.description || "—"}</span>
          </span>
        </div>
        <label className="field">
          Archivo de la skill (Markdown con encabezado)
          <textarea
            className="field__input skill-textarea skill-editor__input"
            rows={18}
            spellCheck={false}
            value={draft}
            placeholder={`${TEMPLATE}Escribe las instrucciones aquí, o pídele al agente que las redacte.`}
            onChange={(event) => onChange(event.target.value)}
            disabled={saving}
          />
        </label>
        {problem && <p className="alert alert--warn">! {problem}</p>}
        {!problem && replacing && dirty && <p className="alert alert--warn">Ya existe una skill llamada “{name}”. Al guardar la reemplazarás.</p>}
        {feedback && (
          <p className={`alert alert--${feedback.error ? "error" : "ok"}`} role={feedback.error ? "alert" : "status"}>
            {feedback.message}
          </p>
        )}
        <div className="skill-editor__actions">
          {!draft.trim() ? (
            <button type="button" className="linkbtn" onClick={() => onChange(TEMPLATE)}>
              usar plantilla
            </button>
          ) : dirty ? (
            <ConfirmButton question="¿Descartar el borrador?" onConfirm={() => onChange("")} disabled={saving}>
              vaciar editor
            </ConfirmButton>
          ) : (
            <button type="button" className="linkbtn" onClick={() => onChange("")} disabled={saving}>
              vaciar editor
            </button>
          )}
          <button type="button" className="btn btn--small" onClick={save} disabled={saving || Boolean(problem) || !draft.trim()}>
            {saving ? <Busy words={["GUARDANDO"]} /> : replacing ? "Reemplazar skill" : "Guardar skill"}
          </button>
        </div>
      </div>
    </TerminalBox>
  );
}
