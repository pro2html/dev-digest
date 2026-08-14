"use client";

import type { OnboardingSection } from "@devdigest/shared";
import { Button, Markdown } from "@devdigest/ui";
import { SECTION_ANCHORS, SECTION_ICONS } from "./constants";
import { SectionCard } from "./SectionCard";
import { s } from "./styles";

export function CriticalPathsSection({
  section,
  emptyLabel,
  openLabel,
  onOpen,
}: {
  section: OnboardingSection;
  emptyLabel: string;
  openLabel: string;
  onOpen: (path: string) => void;
}) {
  const flows = section.flows ?? [];
  return (
    <SectionCard
      id={SECTION_ANCHORS.critical_paths}
      title={section.title}
      icon={SECTION_ICONS.critical_paths}
    >
      <Markdown>{section.body}</Markdown>
      {flows.length === 0 ? <p style={s.emptyIn}>{emptyLabel}</p> : null}
      {flows.map((flow, i) => (
        <div key={`${flow.title}-${i}`} style={s.flowCard}>
          <h3 style={s.flowTitle}>{flow.title}</h3>
          <ol style={s.steps}>
            {flow.steps.map((step, j) => (
              <li key={`${step.label}-${j}`}>
                <div style={s.stepRow}>
                  <span>{step.label}</span>
                  {step.path ? (
                    <Button kind="ghost" size="sm" onClick={() => onOpen(step.path!)}>
                      {openLabel}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </SectionCard>
  );
}
