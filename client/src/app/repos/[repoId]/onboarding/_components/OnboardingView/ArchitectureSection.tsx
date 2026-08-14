"use client";

import type { OnboardingLayoutNode, OnboardingSection } from "@devdigest/shared";
import { Markdown } from "@devdigest/ui";
import { MermaidDiagram } from "@/components/mermaid-diagram";
import { SECTION_ANCHORS, SECTION_ICONS } from "./constants";
import { SectionCard } from "./SectionCard";
import { s } from "./styles";

function LayoutTree({ node }: { node: OnboardingLayoutNode }) {
  return (
    <li>
      {node.name}
      {node.children && node.children.length > 0 ? (
        <ul style={s.tree}>
          {node.children.map((child, i) => (
            <LayoutTree key={`${child.name}-${i}`} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ArchitectureSection({
  section,
  layoutLabel,
}: {
  section: OnboardingSection;
  layoutLabel: string;
}) {
  const diagram = section.diagram?.trim() ?? "";
  return (
    <SectionCard
      id={SECTION_ANCHORS.architecture}
      title={section.title}
      icon={SECTION_ICONS.architecture}
    >
      <Markdown>{section.body}</Markdown>
      {diagram ? <MermaidDiagram chart={diagram} variant="architecture" /> : null}
      {section.layout ? (
        <>
          <div style={s.layoutTitle}>{layoutLabel}</div>
          <ul style={s.tree}>
            <LayoutTree node={section.layout} />
          </ul>
        </>
      ) : null}
    </SectionCard>
  );
}
