"use client";

import React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Icon, Skeleton } from "@devdigest/ui";
import type { BlastPriorPr } from "@devdigest/shared";
import { usePrBlast } from "@/lib/hooks/blast";
import { SymbolRow } from "./SymbolRow";
import { BlastGraphModal } from "./BlastGraphModal";
import { downstreamBySymbol, emptyDownstream, resolveTotals } from "./helpers";
import { s } from "./styles";

interface BlastCardProps {
  prId: string | null;
  repoId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}

function formatTouchedAt(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function PriorPrsFooter({
  priorPrs,
  repoId,
}: {
  priorPrs: BlastPriorPr[];
  repoId: string;
}) {
  const t = useTranslations("prReview.blast");
  const [open, setOpen] = React.useState(false);
  const count = priorPrs.length;

  return (
    <div style={s.footer}>
      <button
        type="button"
        style={s.footerHeader}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Icon.ChevronRight size={14} style={s.chevron(open)} />
        <span style={s.footerTitle}>{t("priorPrs")}</span>
        <span style={s.footerBadge}>{count}</span>
      </button>
      {open &&
        (count === 0 ? (
          <div style={s.footerBody}>{t("priorPrsEmpty")}</div>
        ) : (
          <ul style={s.priorList}>
            {priorPrs.map((pr) => {
              const touched = formatTouchedAt(pr.touched_at);
              return (
                <li key={pr.pr_id} style={s.priorItem}>
                  <div style={s.priorTitleRow}>
                    <Link href={`/repos/${repoId}/pulls/${pr.pr_number}`} style={s.priorLink}>
                      <span className="mono" style={s.priorNumber}>
                        #{pr.pr_number}
                      </span>
                      <span style={s.priorTitle}>{pr.title}</span>
                    </Link>
                    <span style={s.priorMeta}>
                      {pr.status}
                      {touched ? ` · ${touched}` : ""}
                    </span>
                  </div>
                  <div style={s.priorSub}>
                    {t("priorOverlap", { count: pr.overlap_count, author: pr.author })}
                  </div>
                  {pr.files_overlap.length > 0 && (
                    <div style={s.priorFiles}>
                      {pr.files_overlap.slice(0, 4).map((path) => (
                        <span key={path} className="mono" style={s.priorFileChip}>
                          {path}
                        </span>
                      ))}
                      {pr.overlap_count > Math.min(4, pr.files_overlap.length) && (
                        <span style={s.priorMore}>
                          {t("priorMoreFiles", {
                            count: pr.overlap_count - Math.min(4, pr.files_overlap.length),
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}

export function BlastCard({ prId, repoId, repoFullName, headSha }: BlastCardProps) {
  const t = useTranslations("prReview.blast");
  const { data, isLoading, isError, refetch } = usePrBlast(prId);
  const [graphOpen, setGraphOpen] = React.useState(false);

  if (!prId) return null;

  const graphBtn = (
    <button
      type="button"
      style={s.viewBtn(false)}
      onClick={() => setGraphOpen(true)}
      disabled={isLoading || isError || !data}
      title={t("viewGraph")}
    >
      {t("viewGraph")}
    </button>
  );

  if (isLoading) {
    return (
      <section style={s.card}>
        <div style={s.header}>
          <div style={s.titleRow}>
            <Icon.GitBranch size={14} style={s.titleIcon} />
            <span style={s.title}>{t("title")}</span>
          </div>
          {graphBtn}
        </div>
        <div style={s.skeletonWrap}>
          <Skeleton height={14} width="60%" />
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section style={s.card}>
        <div style={s.header}>
          <div style={s.titleRow}>
            <Icon.GitBranch size={14} style={s.titleIcon} />
            <span style={s.title}>{t("title")}</span>
          </div>
        </div>
        <p style={s.muted}>
          {t("error")}{" "}
          <button
            type="button"
            onClick={() => refetch()}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "var(--accent)",
              cursor: "pointer",
              padding: 0,
              fontSize: "inherit",
            }}
          >
            {t("retry")}
          </button>
        </p>
      </section>
    );
  }

  const totals = resolveTotals(data);
  const bySymbol = downstreamBySymbol(data.downstream);
  const showBanner = data.status === "partial" || data.status === "degraded";
  const isEmpty = data.changed_symbols.length === 0;
  const expandDefault = data.changed_symbols.length === 1;
  const priorPrs = data.prior_prs ?? [];

  return (
    <section style={s.card}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.titleRow}>
            <Icon.GitBranch size={14} style={s.titleIcon} />
            <span style={s.title}>{t("title")}</span>
          </div>
          <div style={s.totals}>
            <span style={s.totalItem}>
              <Icon.Code size={12} style={s.totalIcon} />
              {t("statSymbols", { count: totals.symbols })}
            </span>
            <span style={s.totalItem}>
              <Icon.CornerDownRight size={12} style={s.totalIcon} />
              {t("statCallers", { count: totals.callers })}
            </span>
            <span style={s.totalItem}>
              <Icon.Globe size={12} style={s.totalIcon} />
              {t("statEndpoints", { count: totals.endpoints })}
            </span>
            <span style={s.totalItem}>
              <Icon.Clock size={12} style={s.totalIcon} />
              {t("statCrons", { count: totals.crons })}
            </span>
          </div>
        </div>
        <div style={s.viewToggle}>{graphBtn}</div>
      </div>

      {showBanner && (
        <div
          style={{
            ...s.banner,
            ...(data.status === "degraded" ? s.bannerDegraded : null),
          }}
          role="status"
        >
          <Icon.AlertTriangle
            size={13}
            style={{
              flexShrink: 0,
              marginTop: 1,
              color: data.status === "degraded" ? "var(--crit)" : "var(--warn)",
            }}
          />
          <span>
            {data.status === "degraded" ? t("bannerDegraded") : t("bannerPartial")}
            {data.reason ? ` — ${data.reason}` : ""}
          </span>
        </div>
      )}

      {isEmpty ? (
        <p style={s.muted}>{data.reason ?? t("emptyBody")}</p>
      ) : (
        <div style={s.tree}>
          {data.changed_symbols.map((sym, idx) => (
            <SymbolRow
              key={`${sym.file}:${sym.name}:${sym.kind}`}
              symbol={sym}
              impact={bySymbol.get(sym.name) ?? emptyDownstream(sym)}
              defaultExpanded={expandDefault || idx === 0}
              repoFullName={repoFullName}
              headSha={headSha}
            />
          ))}
        </div>
      )}

      <PriorPrsFooter priorPrs={priorPrs} repoId={repoId} />

      {graphOpen && <BlastGraphModal data={data} onClose={() => setGraphOpen(false)} />}
    </section>
  );
}
