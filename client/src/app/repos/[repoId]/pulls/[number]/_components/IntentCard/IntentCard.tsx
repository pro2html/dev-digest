"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, Skeleton } from "@devdigest/ui";
import { usePrIntent, useDerivePrIntent } from "@/lib/hooks/intent";
import { useGeneratePrBrief, usePrBrief } from "@/lib/hooks/brief";
import { changedPathSet } from "./helpers";
import { RiskAreas } from "./RiskAreas";
import { s } from "./styles";

interface IntentCardProps {
  prId: string | null;
  /** Compact layout for Findings tab (lists truncated). */
  compact?: boolean;
  /** Changed-file paths — Risk Areas file citations navigate into Files changed. */
  changedPaths?: string[];
  onFocusFile?: (path: string, line?: number) => void;
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

export function IntentCard({
  prId,
  compact = false,
  changedPaths = [],
  onFocusFile,
}: IntentCardProps) {
  const t = useTranslations("prReview.intent");
  const { data, isLoading, isError, refetch } = usePrIntent(prId);
  const derive = useDerivePrIntent(prId);
  const briefQuery = usePrBrief(compact ? null : prId);
  const generate = useGeneratePrBrief(compact ? null : prId);
  const briefRisks = briefQuery.data?.brief?.risks ?? [];
  const changed = React.useMemo(() => changedPathSet(changedPaths), [changedPaths]);
  const generateMutate = generate.mutate;

  React.useEffect(() => {
    if (compact || !data) return;
    if (!briefQuery.isSuccess) return;
    if (briefQuery.data?.brief != null) return;
    if (generate.isPending || generate.isError) return;
    generateMutate();
  }, [
    compact,
    data,
    briefQuery.isSuccess,
    briefQuery.data?.brief,
    generate.isPending,
    generate.isError,
    generateMutate,
  ]);

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
  const listLimit = compact ? 3 : undefined;
  const risksPending = !compact && (briefQuery.isLoading || generate.isPending);
  const risksFailed = !compact && (briefQuery.isError || generate.isError);
  const showRisks = !compact && onFocusFile != null && (briefRisks.length > 0 || risksPending || risksFailed);

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

        {showRisks && onFocusFile ? (
          <RiskAreas
            risks={briefRisks}
            changed={changed}
            title={t("riskAreas")}
            pending={risksPending}
            pendingLabel={t("risksGenerating")}
            failed={risksFailed && !risksPending}
            failedLabel={t("risksFailed")}
            retryLabel={t("risksRetry")}
            onRetry={() => generate.mutate()}
            onFocusFile={onFocusFile}
          />
        ) : null}
      </CardChrome>
    </section>
  );
}
