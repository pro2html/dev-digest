"use client";

import React from "react";
import { IconBtn } from "@devdigest/ui";
import { s } from "./styles";

export function FilePreviewSidebar({
  path,
  content,
  loading,
  unavailable,
  unavailableLabel,
  loadingLabel,
  closeLabel,
  onClose,
}: {
  path: string;
  content: string | null;
  loading: boolean;
  unavailable: boolean;
  unavailableLabel: string;
  loadingLabel: string;
  closeLabel: string;
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
        <IconBtn icon="X" label={closeLabel} onClick={onClose} />
      </div>
      <div style={s.sidebarBody}>
        {loading ? (
          <p style={s.emptyIn}>{loadingLabel}</p>
        ) : unavailable ? (
          <p style={s.emptyIn}>{unavailableLabel}</p>
        ) : (
          <pre className="mono" style={s.pre}>
            {content}
          </pre>
        )}
      </div>
    </aside>
  );
}
