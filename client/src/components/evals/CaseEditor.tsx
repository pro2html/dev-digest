"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, Toggle } from "@devdigest/ui";
import type { EvalCaseDraft, EvalCaseListItem, EvalOwnerKind, EvalRunResult } from "@devdigest/shared";
import { ApiError } from "../../lib/api";
import {
  useCreateEvalCase,
  useCreateEvalCaseFromFinding,
  useRunEvalCase,
  useUpdateEvalCase,
} from "../../lib/hooks/evals";
import { CaseBanner } from "./CaseBanner";
import { CaseExpectedColumn, type LastRunSummary } from "./CaseExpectedColumn";
import { CaseInputColumn } from "./CaseInputColumn";
import {
  expectationFromJson,
  filesPayload,
  firstFindingFile,
  firstFindingLine,
  firstFindingTitle,
  insertFindingSkeleton,
  parseFilePaths,
  parseJson,
  parseMeta,
  seedToInitial,
  stringifyExpected,
  type InputTab,
} from "./helpers";

export function CaseEditor({
  ownerKind,
  ownerId,
  existing,
  seed,
  onClose,
}: {
  ownerKind: EvalOwnerKind;
  ownerId: string;
  existing?: EvalCaseListItem | null;
  seed?: EvalCaseDraft | null;
  onClose: () => void;
}) {
  const t = useTranslations("eval");
  const create = useCreateEvalCase(ownerKind, ownerId);
  const fromFinding = useCreateEvalCaseFromFinding();
  const update = useUpdateEvalCase(ownerKind, ownerId);
  const run = useRunEvalCase(ownerKind, ownerId);

  const seeded = seedToInitial(
    seed ?? {
      owner_kind: ownerKind,
      owner_id: ownerId,
      name: existing?.name ?? "",
      input_diff: existing?.input_diff ?? "",
      input_files: existing?.input_files ?? null,
      input_meta: existing?.input_meta ?? null,
      expected_output: existing?.expected_output ?? null,
      expectation: existing?.expectation ?? "must_find",
      finding_title: "",
      finding_file: "",
      start_line: 0,
      source: "accepted",
      source_finding_id: "",
    },
  );
  const meta0 = parseMeta(existing?.input_meta ?? seed?.input_meta);

  const [name, setName] = React.useState(existing?.name ?? seeded.name);
  const [diff, setDiff] = React.useState(existing?.input_diff ?? seeded.diff);
  const [filesText, setFilesText] = React.useState(
    parseFilePaths(existing?.input_files ?? seed?.input_files).join("\n"),
  );
  const [title, setTitle] = React.useState(meta0.title);
  const [body, setBody] = React.useState(meta0.body);
  const [expected, setExpected] = React.useState(
    existing?.expected_output != null ? stringifyExpected(existing.expected_output) : seeded.expected,
  );
  const [tab, setTab] = React.useState<InputTab>("diff");
  const [runOnSave, setRunOnSave] = React.useState(Boolean(seed));
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [lastResult, setLastResult] = React.useState<EvalRunResult | null>(null);
  const [savedId, setSavedId] = React.useState(existing?.id ?? null);

  const json = parseJson(expected);
  const jsonOk = json.ok;
  const busy = create.isPending || update.isPending || run.isPending || fromFinding.isPending;
  const canSubmit = name.trim().length > 0 && jsonOk && !busy;
  const expectation = expectationFromJson(expected, existing?.expectation ?? seed?.expectation ?? "must_find");
  const expectedRaw = json.ok ? json.value : existing?.expected_output;
  const findingTitle = seed?.finding_title || firstFindingTitle(expectedRaw);
  const findingFile = seed?.finding_file || firstFindingFile(expectedRaw);
  const findingLine = seed?.start_line || firstFindingLine(expectedRaw);

  const subtitle = seed
    ? t("caseEditor.seededSubtitle", {
        source: seed.source === "accepted" ? t("caseEditor.sourceAccepted") : t("caseEditor.sourceDismissed"),
      })
    : t("caseEditor.subtitle");

  async function persist(): Promise<string | null> {
    if (!canSubmit || !json.ok) return null;
    setFieldError(null);
    const input = {
      owner_kind: ownerKind,
      owner_id: ownerId,
      name: name.trim(),
      input_diff: diff,
      input_files: filesPayload(filesText.split("\n")),
      input_meta: { title, body },
      expected_output: json.value,
      notes: existing?.notes ?? null,
    };
    try {
      if (savedId) {
        const saved = await update.mutateAsync({ id: savedId, input });
        return saved.id;
      }
      if (seed?.source_finding_id) {
        const saved = await fromFinding.mutateAsync({
          findingId: seed.source_finding_id,
          input: {
            name: input.name,
            input_diff: input.input_diff,
            input_files: input.input_files,
            input_meta: input.input_meta,
            expected_output: input.expected_output,
          },
        });
        setSavedId(saved.id);
        return saved.id;
      }
      const saved = await create.mutateAsync(input);
      setSavedId(saved.id);
      return saved.id;
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_expected_output") {
        const field = (err.details as { field?: string } | undefined)?.field;
        setFieldError(field ? `${err.message} (${field})` : err.message);
        return null;
      }
      if (err instanceof ApiError && err.code === "eval_case_exists") {
        const id = (err.details as { case_id?: string } | undefined)?.case_id;
        setFieldError(err.message);
        if (id) setSavedId(id);
        return id ?? null;
      }
      setFieldError(err instanceof Error ? err.message : "Save failed");
      return null;
    }
  }

  async function save(andRun: boolean) {
    const id = await persist();
    if (!id) return;
    if (andRun || runOnSave) {
      const result = await run.mutateAsync(id);
      setLastResult(result);
    } else {
      onClose();
    }
  }

  async function runCase() {
    let id = savedId;
    if (!id) id = await persist();
    if (!id) return;
    const result = await run.mutateAsync(id);
    setLastResult(result);
  }

  const lastSummary = lastRunSummary(lastResult, existing, seed);

  return (
    <Modal
      width={1080}
      title={name.trim() ? t("caseEditor.caseTitle", { name }) : t("caseEditor.newCase")}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginRight: "auto" }}>
            <Toggle on={runOnSave} onChange={setRunOnSave} />
            {t("caseEditor.runOnSave")}
          </div>
          <Button kind="ghost" onClick={onClose}>
            {t("caseEditor.cancel")}
          </Button>
          <Button kind="secondary" icon="Play" disabled={!canSubmit} onClick={() => void runCase()}>
            {t("caseEditor.runCase")}
          </Button>
          <Button kind="primary" icon="Check" disabled={!canSubmit} onClick={() => void save(false)}>
            {busy ? t("caseEditor.saving") : t("caseEditor.save")}
          </Button>
        </div>
      }
    >
      <div style={{ padding: 20, display: "grid", gap: 14 }}>
        <CaseBanner expectation={expectation} title={findingTitle} file={findingFile} line={findingLine} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "stretch" }}>
          <CaseInputColumn
            name={name}
            onName={setName}
            tab={tab}
            onTab={setTab}
            diff={diff}
            onDiff={setDiff}
            filesText={filesText}
            onFiles={setFilesText}
            title={title}
            onTitle={setTitle}
            body={body}
            onBody={setBody}
          />
          <CaseExpectedColumn
            expected={expected}
            onExpected={setExpected}
            jsonOk={jsonOk}
            onSkeleton={() => setExpected((prev) => insertFindingSkeleton(prev))}
            lastSummary={lastSummary}
          />
        </div>
        {fieldError && <div style={{ fontSize: 12, color: "var(--danger)" }}>{fieldError}</div>}
      </div>
    </Modal>
  );
}

function lastRunSummary(
  lastResult: EvalRunResult | null,
  existing?: EvalCaseListItem | null,
  seed?: EvalCaseDraft | null,
): LastRunSummary | null {
  if (lastResult) {
    const actualRaw = lastResult.result.per_trace[0]?.actual as { findings?: unknown } | null | undefined;
    const actual = Array.isArray(actualRaw?.findings) ? actualRaw.findings.length : lastResult.result.traces_passed;
    return {
      passed: Boolean(lastResult.result.traces_passed),
      expected: existing?.expected_count ?? (seed?.expectation === "must_not_flag" ? 0 : 1),
      actual,
      durationMs: lastResult.result.duration_ms,
      costUsd: lastResult.result.cost_usd,
    };
  }
  if (existing?.last_result && existing.last_result !== "never_run") {
    return {
      passed: existing.last_result === "passed",
      expected: existing.expected_count,
      actual: existing.last_actual_count ?? 0,
      durationMs: 0,
      costUsd: null,
    };
  }
  return null;
}
