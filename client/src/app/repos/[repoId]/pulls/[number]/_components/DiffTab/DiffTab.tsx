"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, usePrReviews } from "@/lib/hooks/reviews";
import { notify } from "@/lib/toast";
import type { FindingRecord, PrFile } from "@devdigest/shared";
import { SmartDiffViewer } from "../SmartDiffViewer";

type DiffOrder = "smart" | "original";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
}

export function DiffTab({ prId, filesCount, files, canComment }: DiffTabProps) {
  const t = useTranslations("prReview.smartDiff");
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  const { data: reviews } = usePrReviews(prId);
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);
  const [order, setOrder] = React.useState<DiffOrder>("smart");

  const commentCount = comments?.length ?? 0;

  // Newest review only — matches server Smart Diff finding_lines semantics.
  const latestFindings: FindingRecord[] = React.useMemo(
    () => reviews?.[0]?.findings ?? [],
    [reviews],
  );

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              kind={order === "smart" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setOrder("smart")}
            >
              {t("orderSmart")}
            </Button>
            <Button
              kind={order === "original" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setOrder("original")}
            >
              {t("orderOriginal")}
            </Button>
            {commentCount > 0 ? (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? "Hide comments" : "Show comments"} ({commentCount})
              </Button>
            ) : null}
          </div>
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>
      {order === "smart" ? (
        <SmartDiffViewer
          prId={prId}
          files={files}
          findings={latestFindings}
          commenting={commenting}
        />
      ) : (
        <DiffViewer files={files} commenting={commenting} />
      )}
    </section>
  );
}
