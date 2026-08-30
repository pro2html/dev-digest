"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useUpdateAgent } from "../../../../../../../lib/hooks/agents";
import { useCiInstallations, useCiRuns, type CiInstallationRow } from "../../../../../../../lib/hooks/ci";
import { ExportWizard } from "../ExportWizard";
import { CI_GATE_VALUES, isGateSelected, relativeTime, type CiGateValue } from "./helpers";
import { s } from "./styles";

export function CiTab({ agent }: { agent: Agent }) {
  const t = useTranslations("ci");
  const update = useUpdateAgent();
  const installs = useCiInstallations(agent.id);
  const history = useCiRuns(agent.id);
  const [wizard, setWizard] = React.useState<{ repo?: string } | null>(null);

  const items = installs.data?.items ?? [];
  const activeRepos = new Set(items.map((i) => i.repo)).size;
  const runs = history.data?.items ?? [];

  function setGate(value: CiGateValue) {
    update.mutate({ id: agent.id, patch: { ci_fail_on: value } });
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div>
          <div style={s.title}>{t("ciTab.heading")}</div>
          <div style={s.subtitle}>{t("ciTab.subtitle")}</div>
          <div style={s.count}>{t("ciTab.activeIn", { count: activeRepos })}</div>
        </div>
        <div style={s.actions}>
          <Button kind="primary" onClick={() => setWizard({})}>
            {t("ciTab.addToCi")}
          </Button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
          {t("ciTab.failOnLabel")}
        </div>
        <div style={s.seg} role="group" aria-label={t("ciTab.failOnLabel")}>
          {CI_GATE_VALUES.map((v) => {
            const on = isGateSelected(agent.ci_fail_on, v);
            return (
              <button
                key={v}
                type="button"
                style={{ ...s.segBtn, ...(on ? s.segOn : {}) }}
                aria-pressed={on}
                onClick={() => setGate(v)}
              >
                {t(`ciTab.failOn.${v}`)}
              </button>
            );
          })}
        </div>
        {agent.ci_fail_on === "any" && (
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("ciTab.failOnAnyHint")}</p>
        )}
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>{t("ciTab.failOnStaleHint")}</p>
      </div>

      {items.length === 0 ? (
        <div style={s.card}>
          <p style={s.empty}>{t("ciTab.empty")}</p>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button kind="secondary" onClick={() => setWizard({})}>
              {t("ciTab.addRepository")}
            </Button>
          </div>
        </div>
      ) : (
        <div style={s.list}>
          {items.map((row) => (
            <InstallationRow key={row.id} row={row} onUpdate={() => setWizard({ repo: row.repo })} />
          ))}
          <Button kind="ghost" onClick={() => setWizard({})}>
            {t("ciTab.addRepository")}
          </Button>
        </div>
      )}

      {runs.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", marginBottom: 8 }}>
            {t("ciTab.history")}
          </div>
          <div style={s.hist}>
            {runs.map((r) => (
              <div key={r.id} style={s.histRow}>
                <span>{r.status ?? "—"}</span>
                <span>{relativeTime(r.ran_at)}</span>
                <span>{r.repository ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {wizard && (
        <ExportWizard
          agent={agent}
          initialRepo={wizard.repo}
          onClose={() => setWizard(null)}
        />
      )}
    </div>
  );
}

function InstallationRow({
  row,
  onUpdate,
}: {
  row: CiInstallationRow;
  onUpdate: () => void;
}) {
  const t = useTranslations("ci");
  return (
    <div style={s.card}>
      <div style={s.row}>
        <div>
          <div style={s.repo}>{row.repo}</div>
          <div style={s.meta}>
            {t("ciTab.ghaLabel")}
            {" · "}
            {row.last_status ? t(`ciTab.status.${row.last_status}`) : t("ciTab.statusUnknown")}
            {" · "}
            {relativeTime(row.last_activity_at)}
            {row.exported_agent_version ? ` · v${row.exported_agent_version}` : ""}
          </div>
        </div>
        <Button kind="secondary" size="sm" onClick={onUpdate}>
          {t("ciTab.updateConfig")}
        </Button>
      </div>
    </div>
  );
}
