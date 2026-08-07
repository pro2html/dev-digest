"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Skeleton } from "@devdigest/ui";
import { usePrIntent, useDerivePrIntent } from "@/lib/hooks/intent";
import { s } from "./styles";

interface IntentCardProps {
  prId: string | null;
  /** Compact layout for Findings tab (lists truncated). */
  compact?: boolean;
  /**
   * Optional risk chips (L05 brief). When empty/omitted the Risk areas block
   * is hidden — Intent Layer does not invent risks.
   */
  risks?: { label: string; icon?: "Shield" | "Link" | "Zap" | "AlertTriangle"; color?: string }[];
}

function qualityColor(q: string | null | undefined): string {
  if (q === "high") return "var(--ok)";
  if (q === "medium") return "var(--warn)";
  return "var(--text-muted)";
}

function ScopeList({
  items,
  variant,
  limit,
  emptyLabel,
}: {
  items: string[];
  variant: "in" | "out";
  limit?: number;
  emptyLabel: string;
}) {
  const shown = limit != null ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <span style={s.empty}>{emptyLabel}</span>;
  }
  const bullet = variant === "in" ? s.bulletIn : s.bulletOut;
  return (
    <ul style={s.list}>
      {shown.map((item, i) => (
        <li key={i} style={s.listItem}>
          <span style={bullet} aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CardChrome({
  children,
  compact,
  right,
  title,
  quality,
  qualityLabel,
}: {
  children: React.ReactNode;
  compact: boolean;
  right?: React.ReactNode;
  title: string;
  quality?: string | null;
  qualityLabel?: string;
}) {
  return (
    <div style={compact ? s.cardCompact : s.card}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Icon.Target size={14} style={s.titleIcon} />
          <span style={s.title}>{title}</span>
          {quality && qualityLabel && (
            <Badge color={qualityColor(quality)} bg="transparent">
              {qualityLabel}
            </Badge>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function IntentCard({ prId, compact = false, risks }: IntentCardProps) {
  const t = useTranslations("prReview.intent");
  const { data, isLoading, isError, refetch } = usePrIntent(prId);
  const derive = useDerivePrIntent(prId);

  const onRerun = () => {
    if (!prId) return;
    derive.mutate();
  };

  const rerunBtn = (
    <Button kind="ghost" size="sm" icon="RefreshCw" loading={derive.isPending} onClick={onRerun}>
      {t("rerun")}
    </Button>
  );

  if (!prId) return null;

  if (isLoading) {
    return (
      <section>
        <CardChrome compact={compact} title={t("title")}>
          <div style={s.skeletonWrap}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={56} />
          </div>
        </CardChrome>
      </section>
    );
  }

  if (isError) {
    return (
      <section>
        <CardChrome
          compact={compact}
          title={t("title")}
          right={
            <Button kind="ghost" size="sm" icon="RefreshCw" onClick={() => refetch()}>
              {t("retry")}
            </Button>
          }
        >
          <p style={s.muted}>{t("error")}</p>
        </CardChrome>
      </section>
    );
  }

  if (!data) {
    return (
      <section>
        <CardChrome
          compact={compact}
          title={t("title")}
          right={
            <Button
              kind="primary"
              size="sm"
              icon="Sparkles"
              loading={derive.isPending}
              onClick={onRerun}
            >
              {t("derive")}
            </Button>
          }
        >
          <p style={s.muted}>{t("empty")}</p>
        </CardChrome>
      </section>
    );
  }

  const quality = data.context_quality ?? null;
  const missing = data.missing_context ?? [];
  const listLimit = compact ? 3 : undefined;
  const showRisks = (risks?.length ?? 0) > 0;

  return (
    <section>
      <CardChrome
        compact={compact}
        title={t("title")}
        right={rerunBtn}
        quality={quality}
        qualityLabel={quality ? t(`quality.${quality}`) : undefined}
      >
        <p style={s.summary}>{`\u201C${data.intent}\u201D`}</p>

        <div style={s.columns}>
          <div style={s.column}>
            <div style={s.colHead}>
              <Icon.CheckCircle size={14} style={{ color: "var(--ok)", flexShrink: 0 }} />
              <span style={s.colTitleIn}>{t("inScope")}</span>
            </div>
            <ScopeList
              items={data.in_scope}
              variant="in"
              limit={listLimit}
              emptyLabel={t("none")}
            />
          </div>
          <div style={s.column}>
            <div style={s.colHead}>
              <Icon.XCircle size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span style={s.colTitleOut}>{t("outOfScope")}</span>
            </div>
            <ScopeList
              items={data.out_of_scope}
              variant="out"
              limit={listLimit}
              emptyLabel={t("none")}
            />
          </div>
        </div>

        {showRisks && (
          <>
            <hr style={s.divider} />
            <div style={s.risksBlock}>
              <div style={s.risksHead}>
                <Icon.AlertTriangle size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                <span style={s.risksTitle}>{t("riskAreas")}</span>
              </div>
              <div style={s.riskChips}>
                {risks!.map((chip, i) => {
                  const I = Icon[chip.icon ?? "AlertTriangle"];
                  return (
                    <span key={`${chip.label}-${i}`} style={s.riskChip}>
                      <I size={12} style={{ color: chip.color ?? "var(--warn)", flexShrink: 0 }} />
                      {chip.label}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {missing.length > 0 && (
          <div style={s.warnings}>
            <span>{t("missingContext", { items: missing.join(", ") })}</span>
          </div>
        )}
      </CardChrome>
    </section>
  );
}
