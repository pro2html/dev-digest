"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, MonoLink } from "@devdigest/ui";
import type { ChangedSymbol, DownstreamImpact } from "@devdigest/shared";
import { githubBlobUrl } from "../../../../../../../lib/github-urls";
import { formatSymbolLabel } from "./helpers";
import { s } from "./styles";

interface SymbolRowProps {
  symbol: ChangedSymbol;
  impact: DownstreamImpact;
  defaultExpanded?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
}

export function SymbolRow({
  symbol,
  impact,
  defaultExpanded = false,
  repoFullName,
  headSha,
}: SymbolRowProps) {
  const t = useTranslations("prReview.blast");
  const [open, setOpen] = React.useState(defaultExpanded);
  const label = formatSymbolLabel(symbol);
  const callerCount = impact.callers.length;

  return (
    <div style={s.row}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        style={s.rowHeader}
        aria-expanded={open}
      >
        <Icon.ChevronRight size={14} style={s.chevron(open)} />
        <div style={s.rowMain}>
          <Icon.Code size={13} style={s.symbolIcon} />
          <span style={s.symbolName}>{label}</span>
          <span style={s.callerCount}>
            {t("callerCount", { count: callerCount })}
          </span>
        </div>
      </div>

      {open && (
        <div style={s.rowBody}>
          {impact.callers.length === 0 ? (
            <p style={s.muted}>{t("noCallers")}</p>
          ) : (
            <ul style={s.callers}>
              {impact.callers.map((c, i) => {
                const href =
                  repoFullName && headSha
                    ? githubBlobUrl(repoFullName, headSha, c.file, c.line)
                    : undefined;
                return (
                  <li key={`${c.file}:${c.line}:${c.name}:${i}`} style={s.callerItem}>
                    <Icon.CornerDownRight size={12} style={s.callerIcon} />
                    <MonoLink href={href}>
                      {c.file}:{c.line}
                    </MonoLink>
                  </li>
                );
              })}
            </ul>
          )}

          {(impact.endpoints_affected.length > 0 || impact.crons_affected.length > 0) && (
            <div style={s.tags}>
              {impact.endpoints_affected.map((ep) => (
                <span key={`ep:${ep}`} style={s.endpointTag}>
                  <Icon.Globe size={11} aria-hidden />
                  {ep}
                </span>
              ))}
              {impact.crons_affected.map((cron) => (
                <span key={`cron:${cron}`} style={s.cronTag}>
                  <Icon.Clock size={11} aria-hidden />
                  {cron}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
