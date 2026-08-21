"use client";

import React from "react";
import { SectionLabel } from "@devdigest/ui";
import { IntentCard } from "../IntentCard";
import { BlastCard } from "../BlastCard";
import { s } from "./styles";

interface OverviewTabProps {
  prId: string | null;
  repoId: string;
  prBody: string | null | undefined;
  /** owner/repo — blast caller deep-links. */
  repoFullName?: string | null;
  /** PR head sha — pins blob links to the reviewed revision. */
  headSha?: string | null;
  changedPaths: string[];
  onFocusFile: (path: string, line?: number) => void;
}

export function OverviewTab({
  prId,
  repoId,
  prBody,
  repoFullName,
  headSha,
  changedPaths,
  onFocusFile,
}: OverviewTabProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={s.intentBlastRow}>
        <IntentCard
          prId={prId}
          changedPaths={changedPaths}
          onFocusFile={onFocusFile}
        />
        <BlastCard prId={prId} repoId={repoId} repoFullName={repoFullName} headSha={headSha} />
      </div>

      {prBody && (
        <section>
          <SectionLabel icon="MessageSquare">Description</SectionLabel>
          <div style={s.descriptionBox}>{prBody}</div>
        </section>
      )}
    </div>
  );
}
