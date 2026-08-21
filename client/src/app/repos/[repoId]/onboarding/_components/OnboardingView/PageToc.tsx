"use client";

import React from "react";
import { SECTION_ANCHORS, SECTION_ORDER, type TourSectionKind } from "./constants";
import { s } from "./styles";

export function PageToc({
  label,
  labels,
}: {
  label: string;
  labels: Record<TourSectionKind, string>;
}) {
  const [activeId, setActiveId] = React.useState(SECTION_ANCHORS.architecture);

  React.useEffect(() => {
    const nodes = SECTION_ORDER.map((kind) => document.getElementById(SECTION_ANCHORS[kind])).filter(
      (el): el is HTMLElement => el != null,
    );
    if (nodes.length === 0) return;
    if (typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const id = visible[0]?.target.id;
        if (id) setActiveId(id);
      },
      { rootMargin: "-18% 0px -64% 0px", threshold: [0, 0.25, 0.6] },
    );
    for (const node of nodes) obs.observe(node);
    return () => obs.disconnect();
  }, []);

  const jump = (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
  };

  return (
    <nav aria-label={label} style={s.toc}>
      <div style={s.tocLabel}>{label}</div>
      {SECTION_ORDER.map((kind) => {
        const id = SECTION_ANCHORS[kind];
        const active = activeId === id;
        return (
          <a
            key={kind}
            href={`#${id}`}
            aria-current={active ? "true" : undefined}
            onClick={jump(id)}
            style={{ ...s.tocLink, ...(active ? s.tocLinkActive : null) }}
          >
            {labels[kind]}
          </a>
        );
      })}
    </nav>
  );
}
