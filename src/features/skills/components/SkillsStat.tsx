"use client";

import { useResource } from "@/shared/api";
import { StatTile } from "@/shared/ui";
import { SKILL_LIMIT, listSkills } from "../api";

export function SkillsStat() {
  const { data, loading, error } = useResource("skills", listSkills);

  return (
    <StatTile
      label="skills"
      value={data?.length}
      detail={`de ${SKILL_LIMIT} disponibles`}
      loading={loading}
      failed={Boolean(error) && !data}
    />
  );
}
