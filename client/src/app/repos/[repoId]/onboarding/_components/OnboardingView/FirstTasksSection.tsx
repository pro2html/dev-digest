"use client";

import type { OnboardingSection, TaskComplexity } from "@devdigest/shared";
import { Badge, Button, Markdown } from "@devdigest/ui";
import { COMPLEXITY_STYLE, SECTION_ANCHORS, SECTION_ICONS } from "./constants";
import { SectionCard } from "./SectionCard";
import { s } from "./styles";

export function FirstTasksSection({
  section,
  intro,
  emptyLabel,
  openLabel,
  complexityLabels,
  onOpen,
}: {
  section: OnboardingSection;
  intro: string;
  emptyLabel: string;
  openLabel: string;
  complexityLabels: Record<TaskComplexity, string>;
  onOpen: (path: string) => void;
}) {
  const tasks = section.tasks ?? [];
  return (
    <SectionCard
      id={SECTION_ANCHORS.first_tasks}
      title={section.title}
      icon={SECTION_ICONS.first_tasks}
    >
      <p style={s.intro}>{intro}</p>
      <Markdown>{section.body}</Markdown>
      {tasks.length === 0 ? <p style={s.emptyIn}>{emptyLabel}</p> : null}
      <div style={s.taskGrid}>
        {tasks.map((task, i) => {
          const chrome = COMPLEXITY_STYLE[task.complexity];
          return (
            <div key={`${task.title}-${i}`} style={s.taskCard}>
              <div style={s.stepRow}>
                <Badge color={chrome.color} bg={chrome.bg}>
                  {complexityLabels[task.complexity]}
                </Badge>
              </div>
              <h3 style={s.taskTitle}>{task.title}</h3>
              {task.path ? (
                <div style={s.stepRow}>
                  <span className="mono" style={s.taskPath}>
                    {task.path}
                  </span>
                  <Button kind="ghost" size="sm" onClick={() => onOpen(task.path!)}>
                    {openLabel}
                  </Button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
