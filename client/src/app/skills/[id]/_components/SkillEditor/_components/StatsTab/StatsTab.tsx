"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CAT, Donut, ErrorState, MetricCard, Skeleton } from "@devdigest/ui";
import type { FindingCategory } from "@devdigest/shared";
import { useSkillStats } from "../../../../../../../lib/hooks/skills";
import { CATEGORY_COLORS, CATEGORY_ORDER } from "./constants";
import { s as styles } from "./styles";

/** Stats tab — usage metrics, agents list, findings-by-category donut. */
export function StatsTab({ skillId }: { skillId: string }) {
  const t = useTranslations("skills");
  const notTracked = t("editor.stats.notTrackedYet");
  const { data: stats, isLoading, isError, refetch } = useSkillStats(skillId);

  if (isLoading) {
    return (
      <div style={styles.wrap}>
        <h2 style={styles.title}>{t("editor.stats.title")}</h2>
        <div style={styles.metrics}>
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={96} />
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return <ErrorState body={t("editor.stats.loadError")} onRetry={() => refetch()} />;
  }

  const segments = CATEGORY_ORDER.filter((cat) => (stats.findings_by_category[cat] ?? 0) > 0).map(
    (cat: FindingCategory) => ({
      label: CAT[cat].label,
      value: stats.findings_by_category[cat] ?? 0,
      color: CATEGORY_COLORS[cat],
    }),
  );

  return (
    <div style={styles.wrap}>
      <h2 style={styles.title}>{t("editor.stats.title")}</h2>

      <div style={styles.metrics}>
        <MetricCard label={t("editor.stats.usedBy")} value={stats.used_by_agents} />
        <MetricCard
          label={t("editor.stats.pullFrequency")}
          value={
            <span title={stats.pull_frequency == null ? notTracked : undefined}>
              {stats.pull_frequency == null ? "—" : stats.pull_frequency}
            </span>
          }
        />
        <MetricCard
          label={t("editor.stats.acceptRate")}
          value={
            <span title={stats.accept_rate == null ? notTracked : undefined}>
              {stats.accept_rate == null ? "—" : `${Math.round(stats.accept_rate * 100)}`}
            </span>
          }
          suffix={stats.accept_rate == null ? undefined : "%"}
        />
        <MetricCard label={t("editor.stats.findings30d")} value={stats.findings_30d} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t("editor.stats.agentsTitle")}</div>
        {stats.agents.length === 0 ? (
          <p style={styles.empty}>{t("editor.stats.agentsEmpty")}</p>
        ) : (
          <div style={styles.agentsList}>
            {stats.agents.map((a) => (
              <Link key={a.id} href={`/agents/${a.id}`} style={styles.agentLink}>
                {a.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>{t("editor.stats.byCategory")}</div>
        {segments.length === 0 ? (
          <p style={styles.empty}>{t("editor.stats.byCategoryEmpty")}</p>
        ) : (
          <div style={styles.donutCard}>
            <Donut segments={segments} valuePrefix="" formatValue={(n) => String(n)} />
          </div>
        )}
      </div>
    </div>
  );
}
