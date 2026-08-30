"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ExportWizardSteps, Modal, TextInput } from "@devdigest/ui";
import type { Agent, CiFile } from "@devdigest/shared";
import { useActiveRepo } from "../../../../../../../lib/repo-context";
import {
  useCiExportOpenPr,
  useCiExportZip,
  useCiPrepareInstall,
  useCiPreview,
} from "../../../../../../../lib/hooks/ci";
import { ApiError } from "../../../../../../../lib/api";
import { isValidRepo, providerSecretName } from "../CiTab/helpers";

const STEPS = ["target", "preview", "configure", "install"] as const;
type Step = (typeof STEPS)[number];
const TRIGGERS = ["opened", "synchronize", "reopened"] as const;
const POST_AS = ["github_review", "pr_comment", "none"] as const;

export function ExportWizard({
  agent,
  initialRepo,
  onClose,
}: {
  agent: Agent;
  initialRepo?: string;
  onClose: () => void;
}) {
  const t = useTranslations("ci");
  const { activeRepo } = useActiveRepo();
  const [step, setStep] = React.useState<Step>("target");
  const [repo, setRepo] = React.useState(initialRepo ?? activeRepo?.full_name ?? "");
  const [files, setFiles] = React.useState<CiFile[]>([]);
  const [selectedPath, setSelectedPath] = React.useState<string | null>(null);
  const [workflowEdit, setWorkflowEdit] = React.useState<string | undefined>();
  const [triggers, setTriggers] = React.useState<string[]>(["opened", "synchronize"]);
  const [postAs, setPostAs] = React.useState<(typeof POST_AS)[number]>("github_review");
  const [prUrl, setPrUrl] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | undefined>();
  const [secretName, setSecretName] = React.useState("DEVDIGEST_INGEST_TOKEN");

  const preview = useCiPreview(agent.id);
  const prepare = useCiPrepareInstall(agent.id);
  const openPr = useCiExportOpenPr(agent.id);
  const zip = useCiExportZip(agent.id);

  const labels = STEPS.map((k) => t(`exportWizard.steps.${k}`));
  const stepIndex = STEPS.indexOf(step);
  const selected = files.find((f) => f.path === selectedPath) ?? files[0];
  const workflowPath = files.find((f) => f.editable)?.path;
  const displayContents =
    selected && selected.path === workflowPath && workflowEdit !== undefined ? workflowEdit : selected?.contents ?? "";

  function exportBody() {
    return {
      repo: repo.trim(),
      target: "gha" as const,
      post_as: postAs,
      triggers,
      base: activeRepo?.default_branch ?? "main",
      workflow_override: workflowEdit,
    };
  }

  async function goPreview() {
    setError(null);
    if (!isValidRepo(repo)) {
      setError(t("exportWizard.invalidRepo"));
      return;
    }
    try {
      const res = await preview.mutateAsync({
        repo: repo.trim(),
        target: "gha",
        post_as: postAs,
        triggers,
        base: activeRepo?.default_branch ?? "main",
      });
      setFiles(res.files);
      setSelectedPath(res.files[0]?.path ?? null);
      const wf = res.files.find((f) => f.editable);
      setWorkflowEdit(wf?.contents);
      setStep("preview");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("exportWizard.previewFailed"));
    }
  }

  async function goInstall() {
    setError(null);
    try {
      const prep = await prepare.mutateAsync();
      setSecretName(prep.ingest_secret_name);
      setToken(prep.ingest_token);
      setStep("install");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("exportWizard.previewFailed"));
    }
  }

  async function confirmPr() {
    setError(null);
    try {
      const res = await openPr.mutateAsync(exportBody());
      setPrUrl(res.pr_url);
      if (res.ingest_token) setToken(res.ingest_token);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === "missing_github_token") setError(t("exportWizard.missingToken"));
      else if (code === "github_pr_failed") setError(t("exportWizard.githubFailed"));
      else if (code === "invalid_manifest") setError(t("exportWizard.invalidManifest"));
      else setError(e instanceof ApiError ? e.message : t("exportWizard.githubFailed"));
    }
  }

  async function confirmZip() {
    setError(null);
    try {
      const blob = await zip.mutateAsync(exportBody());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "devdigest-ci.zip";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      if (code === "invalid_manifest") setError(t("exportWizard.invalidManifest"));
      else setError(e instanceof ApiError ? e.message : t("exportWizard.zipFailed"));
    }
  }

  function toggleTrigger(name: string) {
    setTriggers((cur) => (cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name]));
  }

  return (
    <Modal
      width={880}
      title={t("exportWizard.title")}
      subtitle={t("exportWizard.subtitle", { agentName: agent.name })}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", gap: 8 }}>
          <Button
            kind="ghost"
            disabled={step === "target"}
            onClick={() => {
              setError(null);
              if (step === "preview") setStep("target");
              else if (step === "configure") setStep("preview");
              else if (step === "install") setStep("configure");
            }}
          >
            {t("exportWizard.back")}
          </Button>
          {step === "target" && (
            <Button kind="primary" loading={preview.isPending} onClick={() => void goPreview()}>
              {t("exportWizard.continue")}
            </Button>
          )}
          {step === "preview" && (
            <Button kind="primary" onClick={() => setStep("configure")}>
              {t("exportWizard.continue")}
            </Button>
          )}
          {step === "configure" && (
            <Button kind="primary" loading={prepare.isPending} onClick={() => void goInstall()}>
              {t("exportWizard.continue")}
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: "grid", gap: 18 }}>
        <ExportWizardSteps step={stepIndex} labels={labels} />
        {error && <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        {step === "target" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                border: "1px solid var(--accent)",
                borderRadius: 10,
                padding: 14,
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ fontWeight: 600 }}>{t("exportWizard.targets.gha")}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {t("exportWizard.targets.ghaDesc")} · {t("exportWizard.recommended")}
              </div>
            </div>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{t("exportWizard.repoLabel")}</span>
              <TextInput
                placeholder={t("exportWizard.repoPlaceholder")}
                value={repo}
                onChange={setRepo}
              />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("exportWizard.repoHint")}</span>
            </label>
          </div>
        )}

        {step === "preview" && (
          <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 12, minHeight: 280 }}>
            <div style={{ display: "grid", alignContent: "start", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                {t("exportWizard.filesToCreate")}
              </div>
              {files.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  onClick={() => setSelectedPath(f.path)}
                  style={{
                    textAlign: "left",
                    fontSize: 12,
                    padding: "6px 8px",
                    borderRadius: 6,
                    border: "1px solid transparent",
                    background: f.path === selected?.path ? "var(--bg-elevated)" : "transparent",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                  }}
                >
                  {f.path}
                  {f.editable ? ` · ${t("exportWizard.editable")}` : ""}
                </button>
              ))}
            </div>
            <textarea
              readOnly={!selected?.editable}
              value={displayContents}
              onChange={(e) => {
                if (selected?.editable) setWorkflowEdit(e.target.value);
              }}
              style={{
                width: "100%",
                minHeight: 280,
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                padding: 10,
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: selected?.editable ? "var(--bg)" : "var(--bg-elevated)",
              }}
            />
          </div>
        )}

        {step === "configure" && (
          <div style={{ display: "grid", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t("exportWizard.triggerLabel")}</div>
              {TRIGGERS.map((name) => (
                <label key={name} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                  <input
                    type="checkbox"
                    checked={triggers.includes(name)}
                    onChange={() => toggleTrigger(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{t("exportWizard.postResultsLabel")}</div>
              {POST_AS.map((v) => (
                <label key={v} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 6 }}>
                  <input type="radio" name="postas" checked={postAs === v} onChange={() => setPostAs(v)} />
                  {t(`exportWizard.postAs.${v === "github_review" ? "githubReview" : v === "pr_comment" ? "prComment" : "none"}`)}
                  {v === "github_review" ? ` (${t("exportWizard.recommended")})` : ""}
                </label>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {t("exportWizard.blockMergeTitle")}: {t("exportWizard.blockMergeDesc")}
            </p>
          </div>
        )}

        {step === "install" && (
          <div style={{ display: "grid", gap: 14 }}>
            <div style={{ border: "1px solid var(--accent)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 600 }}>{t("exportWizard.installCardTitle")}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                {t("exportWizard.installCardBody", { repo: repo.trim() || t("exportWizard.ownerRepo"), count: files.length })}
              </p>
              <Button kind="primary" loading={openPr.isPending} onClick={() => void confirmPr()} style={{ marginTop: 10 }}>
                {t("exportWizard.install")}
              </Button>
              {prUrl && (
                <p style={{ marginTop: 10, fontSize: 13 }}>
                  <a href={prUrl} target="_blank" rel="noreferrer">
                    {t("exportWizard.openPr")}
                  </a>
                </p>
              )}
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 600 }}>{t("exportWizard.zipTitle")}</div>
              <Button kind="secondary" loading={zip.isPending} onClick={() => void confirmZip()} style={{ marginTop: 10 }}>
                {t("exportWizard.zipAction")}
              </Button>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {t("exportWizard.secretNote", {
                key: providerSecretName(agent.provider),
                ingest: secretName,
              })}
            </p>
            {token ? (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{t("exportWizard.ingestTokenOnce")}</span>
                <TextInput value={token} readOnly />
              </label>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("exportWizard.ingestExists", { name: secretName })}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
