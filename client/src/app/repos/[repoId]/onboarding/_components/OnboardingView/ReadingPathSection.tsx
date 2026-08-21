"use client";

import type { OnboardingSection } from "@devdigest/shared";
import { Button, Markdown } from "@devdigest/ui";
import { SECTION_ANCHORS, SECTION_ICONS } from "./constants";
import { SectionCard } from "./SectionCard";
import { s } from "./styles";

export function ReadingPathSection({
  section,
  startLabel,
  nextLabel,
  emptyLabel,
  openLabel,
  onOpen,
}: {
  section: OnboardingSection;
  startLabel: string;
  nextLabel: string;
  emptyLabel: string;
  openLabel: string;
  onOpen: (path: string) => void;
}) {
  const items = section.links;
  return (
    <SectionCard
      id={SECTION_ANCHORS.reading_path}
      title={section.title}
      icon={SECTION_ICONS.reading_path}
    >
      <Markdown>{section.body}</Markdown>
      {items.length === 0 ? <p style={s.emptyIn}>{emptyLabel}</p> : null}
      {items.map((item, i) => (
        <div key={`${item.path}-${i}`} style={s.readingItem}>
          <span style={s.readingNum}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.stepRow}>
              <span style={i === 0 ? s.startMark : s.nextMark}>{i === 0 ? startLabel : nextLabel}</span>
              <span className="mono">{item.path}</span>
              <Button kind="ghost" size="sm" onClick={() => onOpen(item.path)}>
                {openLabel}
              </Button>
            </div>
            {item.note ? <div style={s.note}>{item.note}</div> : null}
            <div style={{ fontSize: 13, marginTop: 2 }}>{item.label}</div>
          </div>
        </div>
      ))}
    </SectionCard>
  );
}
