"use client";

import { useState } from "react";
import { useResource } from "@/shared/api";
import { listSkills, type Skill } from "../api";
import { serializeSkill } from "../draft";
import { SkillCoworking } from "./SkillCoworking";
import { SkillEditor } from "./SkillEditor";
import { SkillUploader } from "./SkillUploader";
import { SkillsLibrary } from "./SkillsLibrary";

export function SkillsWorkspace() {
  const skills = useResource("skills", listSkills);
  const [draft, setDraft] = useState("");
  // Last content loaded into or saved from the editor; anything else counts as unsaved work.
  const [baseline, setBaseline] = useState("");
  const dirty = draft.trim() !== "" && draft !== baseline;

  function load(content: string) {
    setDraft(content);
    setBaseline(content);
  }

  return (
    <>
      <div className="skills-workspace">
        <SkillCoworking
          draft={draft}
          onLoadDraft={load}
          onAgentDraft={(content) => {
            // Never overwrite hand edits; the chat keeps a button to load the draft instead.
            if (!dirty) load(content);
          }}
        />
        <SkillEditor draft={draft} dirty={dirty} skills={skills.data} onChange={setDraft} onSaved={setBaseline} />
      </div>
      <SkillUploader skills={skills.data} dirty={dirty} onOpen={(content) => setDraft(content)} />
      <SkillsLibrary
        skills={skills.data}
        loading={skills.loading}
        error={skills.error}
        reload={skills.reload}
        dirty={dirty}
        onEdit={(skill: Skill) => load(serializeSkill(skill))}
      />
    </>
  );
}
