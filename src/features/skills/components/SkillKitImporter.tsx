"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { errorMessage, revalidate } from "@/shared/api";
import { Busy, TerminalBox } from "@/shared/ui";
import { importSkills, type Skill } from "../api";
import { MAX_SKILLS_PER_IMPORT } from "../draft";
import { MAX_KIT_FILE_BYTES, isKitTextFile, readKit, type KitSkill } from "../kit";

// Folder picking is non-standard, so React's input typings leave it out.
const FOLDER_PICKER = { webkitdirectory: "", directory: "" } as InputHTMLAttributes<HTMLInputElement>;

interface SkillKitImporterProps {
  skills: Skill[] | undefined;
}

export function SkillKitImporter({ skills }: SkillKitImporterProps) {
  const [found, setFound] = useState<KitSkill[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const known = new Set(skills?.map((skill) => skill.name));

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setFeedback(null);
    const readable = Array.from(files).filter((file) => isKitTextFile(file.webkitRelativePath || file.name) && file.size <= MAX_KIT_FILE_BYTES);
    const kit = readKit(
      await Promise.all(readable.map(async (file) => ({ path: file.webkitRelativePath || file.name, text: await file.text() }))),
    );
    setFound(kit);
    setSelected(new Set(kit.filter((skill) => !skill.problem).map((skill) => skill.name)));
    if (!kit.length) setFeedback({ error: true, message: "La carpeta no contiene ningún SKILL.md." });
  }

  function toggle(name: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function save() {
    if (!found || busy || !selected.size) return;
    setBusy(true);
    setFeedback(null);
    try {
      const chosen = found.filter((skill) => selected.has(skill.name));
      const saved = await importSkills(chosen.map((skill) => skill.import));
      const replaced = saved.filter((skill) => known.has(skill.name)).length;
      setFeedback({
        error: false,
        message: `${saved.length} skills importadas${replaced ? ` (${replaced} reemplazadas)` : ""}. El agente ya puede usarlas.`,
      });
      setFound(null);
      await revalidate("skills");
    } catch (err) {
      setFeedback({ error: true, message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  const tooMany = selected.size > MAX_SKILLS_PER_IMPORT;

  return (
    <TerminalBox wide title="IMPORTAR KIT" status={found ? `${selected.size} de ${found.length} seleccionadas` : "Carpeta con SKILL.md"}>
      <div className="stack">
        <p>
          Elige la carpeta de un kit de skills. Cada <code>SKILL.md</code> se importa con los archivos de texto de su carpeta como archivos de
          referencia; si hay un <code>skills.json</code>, solo las skills que lista. Nada se guarda hasta que confirmes, y si una falla no se guarda
          ninguna.
        </p>
        <div>
          <button type="button" className="btn btn--small" onClick={() => inputRef.current?.click()} disabled={busy}>
            Elegir carpeta
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            data-testid="skill-kit-folder"
            {...FOLDER_PICKER}
            onChange={(event) => {
              void pick(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {found && found.length > 0 && (
          <>
            <ul className="uploads">
              {found.map((skill) => (
                <li key={skill.folder} className={`upload upload--${skill.problem ? "error" : "done"}`}>
                  <label className="upload__name">
                    <input
                      type="checkbox"
                      checked={selected.has(skill.name)}
                      disabled={Boolean(skill.problem) || busy}
                      onChange={() => toggle(skill.name)}
                    />{" "}
                    {skill.name}
                  </label>
                  <span className="upload__state">
                    {skill.problem ??
                      [
                        known.has(skill.name) ? "Reemplaza la existente" : "Nueva",
                        `${Object.keys(skill.import.files).length} archivos de referencia`,
                      ].join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            {tooMany && <p className="alert alert--warn">! Una importación admite como máximo {MAX_SKILLS_PER_IMPORT} skills.</p>}
            <div className="row-between">
              <button type="button" className="linkbtn" onClick={() => setFound(null)} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn btn--small" onClick={save} disabled={busy || !selected.size || tooMany}>
                {busy ? <Busy words={["IMPORTANDO"]} /> : `Importar ${selected.size} skills`}
              </button>
            </div>
          </>
        )}

        {feedback && (
          <p className={`alert alert--${feedback.error ? "error" : "ok"}`} role={feedback.error ? "alert" : "status"}>
            {feedback.message}
          </p>
        )}
      </div>
    </TerminalBox>
  );
}
