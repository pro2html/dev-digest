"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@devdigest/ui";
import type { RunTrace } from "@devdigest/shared";
import { PreviewSidebar } from "@/components/ContextAttach";
import { estimateTokens } from "@/components/SkillBodyEditor/helpers";
import { parseInjectedSpecs } from "../../helpers";
import { s } from "../../styles";
import { TraceSection } from "../TraceSection";

export function ProjectContextSection({ trace }: { trace: RunTrace }) {
  const t = useTranslations("runs");
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);

  const files = parseInjectedSpecs(trace.prompt_assembly.specs, trace.specs_read);
  const hasFiles = files.length > 0;
  const totalTokens = files.reduce((sum, f) => sum + estimateTokens(f.content), 0);
  const preview = files.find((f) => f.path === previewPath);

  return (
    <TraceSection
      icon="FileText"
      title={t("trace.projectContext")}
      right={<Badge color="var(--text-muted)">{trace.specs_read.length}</Badge>}
    >
      {!hasFiles ? (
        <span style={s.noToolCalls}>{t("trace.projectContextEmpty")}</span>
      ) : (
        <>
          <div style={s.contextList} role="list">
            {files.map((f) => (
              <div key={f.path} role="listitem" style={s.contextRow}>
                <Icon.FileText size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span className="mono" style={s.contextPath} title={f.path}>
                  {f.path}
                </span>
                <span style={s.contextTokens}>
                  {t("trace.projectContextFileTokens", { count: estimateTokens(f.content) })}
                </span>
                <Button kind="ghost" size="sm" icon="Eye" onClick={() => setPreviewPath(f.path)}>
                  {t("trace.prompt.preview")}
                </Button>
              </div>
            ))}
          </div>
          <div style={s.contextFooter}>{t("trace.projectContextTokens", { count: totalTokens })}</div>
        </>
      )}
      {previewPath ? (
        <PreviewSidebar
          path={previewPath}
          content={preview?.content ?? ""}
          onClose={() => setPreviewPath(null)}
        />
      ) : null}
    </TraceSection>
  );
}
