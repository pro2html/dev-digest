"use client";

import React from "react";
import { IconBtn } from "@devdigest/ui";
import { MarkdownDoc } from "@/components/MarkdownDoc";
import { s } from "./styles";

export function PreviewSidebar({
  path,
  content,
  onClose,
}: {
  path: string;
  content: string;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside aria-label={path} style={s.sidebar}>
      <div style={s.sidebarHeader}>
        <span className="mono" style={s.sidebarTitle} title={path}>
          {path}
        </span>
        <IconBtn icon="X" label="Close" onClick={onClose} />
      </div>
      <div style={s.sidebarBody}>
        <MarkdownDoc>{content}</MarkdownDoc>
      </div>
    </aside>
  );
}
