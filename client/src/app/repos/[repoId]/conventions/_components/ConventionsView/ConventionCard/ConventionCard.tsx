"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Chip,
  Icon,
  IconBtn,
  PercentProgress,
  TextInput,
} from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { confidenceColor } from "../helpers";
import { s } from "./styles";

interface Props {
  candidate: ConventionCandidate;
  onAccept: () => void;
  onUnaccept: () => void;
  onReject: () => void;
  onPatchRule: (rule: string) => void;
}

export function ConventionCard({
  candidate,
  onAccept,
  onUnaccept,
  onReject,
  onPatchRule,
}: Props) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(candidate.rule);
  const [copied, setCopied] = React.useState(false);
  const [hoverRule, setHoverRule] = React.useState(false);

  const isAccepted = candidate.status === "accepted";
  const isRejected = candidate.status === "rejected";
  const borderColor = isAccepted ? "var(--ok)" : "var(--border)";

  const evidenceLabel = candidate.evidence_path
    ? `${candidate.evidence_path}${candidate.evidence_line != null ? `:${candidate.evidence_line}` : ""}`
    : null;

  const handleSave = () => {
    if (draft.trim() && draft !== candidate.rule) {
      onPatchRule(draft.trim());
    }
    setEditing(false);
  };

  const copyEvidence = () => {
    if (!evidenceLabel) return;
    void navigator.clipboard?.writeText(evidenceLabel);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div style={s.card(borderColor, isRejected)}>
      <div style={s.main}>
        {editing ? (
          <div style={s.editRow}>
            <TextInput value={draft} onChange={setDraft} />
            <Button kind="primary" size="sm" onClick={handleSave}>
              Save
            </Button>
            <Button
              kind="ghost"
              size="sm"
              onClick={() => {
                setEditing(false);
                setDraft(candidate.rule);
              }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div
            style={s.ruleRow}
            onMouseEnter={() => setHoverRule(true)}
            onMouseLeave={() => setHoverRule(false)}
          >
            <p style={s.rule}>{candidate.rule}</p>
            {candidate.edited && <Chip>{t("card.edited")}</Chip>}
            {(hoverRule || editing) && (
              <IconBtn
                icon="Edit"
                label={t("card.edit")}
                size={28}
                onClick={() => setEditing(true)}
              />
            )}
          </div>
        )}

        <div style={s.chips}>
          <Chip>{candidate.category}</Chip>
          {candidate.applies_to && (
            <Chip>
              <span className="mono">{candidate.applies_to}</span>
            </Chip>
          )}
        </div>

        {(evidenceLabel || candidate.evidence_snippet) && (
          <div style={s.evidence}>
            {evidenceLabel && (
              <div style={s.evidenceHead}>
                <span className="mono" style={s.evidencePath}>
                  {evidenceLabel}
                </span>
                <button
                  type="button"
                  title="Copy"
                  aria-label="Copy"
                  onClick={copyEvidence}
                  style={s.copyBtn}
                >
                  {copied ? <Icon.Check size={12} /> : <Icon.Copy size={12} />}
                </button>
              </div>
            )}
            {candidate.evidence_snippet && (
              <pre className="mono" style={s.evidencePre}>
                {candidate.evidence_snippet}
              </pre>
            )}
          </div>
        )}

        <div style={s.footer} title={t("card.confidenceTitle")}>
          {candidate.support_count != null ? (
            <span style={s.support}>
              {t("card.support", {
                support: candidate.support_count,
                violations: candidate.violation_count ?? 0,
              })}
            </span>
          ) : (
            <div style={{ flex: 1, minWidth: 160 }}>
              <PercentProgress
                value={candidate.confidence * 100}
                label={t("card.confidence")}
                color={confidenceColor(candidate.confidence)}
              />
            </div>
          )}
        </div>
      </div>

      <div style={s.actions}>
        <Button
          kind="primary"
          size="md"
          icon="Check"
          active={isAccepted}
          style={s.actionBtn}
          onClick={isAccepted ? onUnaccept : onAccept}
        >
          {isAccepted ? t("card.accepted") : t("card.accept")}
        </Button>
        <Button
          kind="secondary"
          size="md"
          icon="X"
          style={s.actionBtn}
          onClick={onReject}
        >
          {t("card.reject")}
        </Button>
      </div>
    </div>
  );
}
