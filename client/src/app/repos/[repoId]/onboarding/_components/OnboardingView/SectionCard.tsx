"use client";

import React from "react";
import { Icon, type IconName } from "@devdigest/ui";
import { s } from "./styles";

export function SectionCard({
  id,
  title,
  icon,
  children,
}: {
  id: string;
  title: string;
  icon: IconName;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(true);
  const Glyph = Icon[icon];
  return (
    <section id={id} style={s.card}>
      <button
        type="button"
        style={s.cardHeader}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={s.cardIcon}>
          <Glyph size={15} />
        </span>
        <h2 style={s.cardTitle}>{title}</h2>
        <Icon.ChevronDown
          size={16}
          style={{
            ...s.chevron,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
      {open ? <div style={s.cardBody}>{children}</div> : null}
    </section>
  );
}
