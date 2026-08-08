"use client";

import React, { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { PrBlastRecord } from "@devdigest/shared";
import { buildBlastGraph } from "./graph-model";
import { BlastGraph } from "./BlastGraph";
import { s } from "./styles";

interface BlastGraphModalProps {
  data: PrBlastRecord;
  onClose: () => void;
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.floor(rect.width)),
        height: Math.max(1, Math.floor(rect.height)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

export function BlastGraphModal({ data, onClose }: BlastGraphModalProps) {
  const t = useTranslations("prReview.blast");
  const model = buildBlastGraph(data);
  const { ref, size } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("graphAria")}
      style={s.graphModalOverlay}
    >
      <div style={s.graphModal}>
        <button type="button" style={s.graphClose} onClick={onClose} aria-label={t("graphClose")}>
          <Icon.X size={18} />
        </button>

        <div ref={ref} style={s.graphCanvas}>
          {model.nodes.length === 0 ? (
            <p style={{ ...s.muted, padding: 24, textAlign: "center" }}>{t("graphEmpty")}</p>
          ) : size.width > 0 && size.height > 0 ? (
            <BlastGraph
              model={model}
              width={size.width}
              height={size.height}
              ariaLabel={t("graphAria")}
            />
          ) : null}
        </div>

        <div style={s.graphLegend}>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: "#7c3aed" }} />
            {t("legendSymbol")}
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: "#a1a1aa" }} />
            {t("legendCaller")}
          </span>
          <span style={s.legendItem}>
            <span style={{ ...s.legendDot, background: "#10b981" }} />
            {t("legendEndpoint")}
          </span>
        </div>
      </div>
    </div>
  );
}
