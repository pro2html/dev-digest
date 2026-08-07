"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { ErrorState, Markdown, Skeleton } from "@devdigest/ui";
import { useSkillVersions } from "../../../../../../../lib/hooks/skills";
import { s } from "./styles";

/** Versions tab — read-only list of body snapshots. */
export function VersionsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skillId);
  const [open, setOpen] = React.useState<number | null>(null);

  if (isLoading) {
    return (
      <div style={s.wrap}>
        <h2 style={s.title}>{t("editor.versions.title")}</h2>
        <Skeleton height={48} />
        <div style={{ height: 10 }} />
        <Skeleton height={48} />
      </div>
    );
  }

  if (isError) {
    return <ErrorState body={t("editor.versions.loadError")} onRetry={() => refetch()} />;
  }

  const list = versions ?? [];

  return (
    <div style={s.wrap}>
      <h2 style={s.title}>{t("editor.versions.title")}</h2>
      {list.length === 0 ? (
        <p style={s.empty}>{t("editor.versions.empty")}</p>
      ) : (
        <div style={s.list}>
          {list.map((v) => {
            const expanded = open === v.version;
            return (
              <div key={v.version} style={s.item}>
                <button
                  type="button"
                  style={s.header}
                  onClick={() => setOpen(expanded ? null : v.version)}
                  aria-expanded={expanded}
                >
                  <span className="mono" style={s.version}>
                    {t("editor.versions.versionLabel", { version: v.version })}
                  </span>
                  <span style={s.date}>{formatDate(v.created_at)}</span>
                </button>
                {expanded && (
                  <div style={s.body}>
                    <Markdown>{v.body}</Markdown>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
