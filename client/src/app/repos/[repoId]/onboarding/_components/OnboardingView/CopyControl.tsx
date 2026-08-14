"use client";

import React from "react";
import { Button } from "@devdigest/ui";
import { copyText } from "./helpers";

export function CopyControl({
  text,
  idle,
  copied,
  failed,
}: {
  text: string;
  idle: string;
  copied: string;
  failed: string;
}) {
  const [status, setStatus] = React.useState<"idle" | "ok" | "fail">("idle");

  React.useEffect(() => {
    if (status === "idle") return;
    const t = window.setTimeout(() => setStatus("idle"), 1600);
    return () => window.clearTimeout(t);
  }, [status]);

  return (
    <Button
      kind="ghost"
      size="sm"
      icon="Copy"
      onClick={async () => {
        const ok = await copyText(text);
        setStatus(ok ? "ok" : "fail");
      }}
    >
      {status === "ok" ? copied : status === "fail" ? failed : idle}
    </Button>
  );
}
