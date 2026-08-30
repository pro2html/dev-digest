"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, SEV, SectionLabel, Toggle } from "@devdigest/ui";
import type { Conflict } from "@devdigest/shared";
import { s } from "./styles";

export function ConflictsBlock({
  locations,
  onlyConflicts,
  onOnlyConflicts,
}: {
  locations: Conflict[];
  onlyConflicts: boolean;
  onOnlyConflicts: (on: boolean) => void;
}) {
  const t = useTranslations("multiAgent");

  return (
    <div style={s.disagreeWrap} data-testid="disagree-block">
      <SectionLabel
        icon="Activity"
        right={
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--text-secondary)" }}>
            {t("results.showConflicts")}
            <Toggle on={onlyConflicts} onChange={onOnlyConflicts} size={15} />
          </label>
        }
      >
        {t("results.disagreeTitle")}
      </SectionLabel>
      {locations.length === 0 ? (
        <p style={{ ...s.empty, padding: "4px 0 12px" }} data-testid="disagree-empty">
          {onlyConflicts ? t("results.noConflicts") : t("results.emptyLocations")}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {locations.map((loc) => (
            <div key={`${loc.file}:${loc.line}`} style={s.loc}>
              <div style={s.locHead}>
                <Icon.Code size={13} style={{ color: "var(--text-muted)" }} />
                <span className="mono" style={{ fontSize: 12 }}>
                  {loc.file}:{loc.line}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6 }}>{loc.title}</span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${Math.max(loc.takes.length, 1)}, 1fr)`,
                  gap: 1,
                  background: "var(--border)",
                }}
              >
                {loc.takes.map((take) => {
                  const flagged = take.verdict !== "ignored";
                  const sev = flagged && take.verdict in SEV ? SEV[take.verdict as keyof typeof SEV] : null;
                  return (
                    <div key={take.agent_id} style={s.take}>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {take.persona}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 99,
                            background: flagged ? (sev?.c ?? "var(--warn)") : "var(--text-muted)",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: flagged ? "var(--text-primary)" : "var(--text-muted)",
                            textTransform: flagged ? "uppercase" : "none",
                            letterSpacing: flagged ? "0.03em" : 0,
                          }}
                        >
                          {flagged ? take.verdict : t("results.didNotFlag")}
                        </span>
                      </div>
                      {take.note ? (
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", lineHeight: 1.4 }}>{take.note}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
