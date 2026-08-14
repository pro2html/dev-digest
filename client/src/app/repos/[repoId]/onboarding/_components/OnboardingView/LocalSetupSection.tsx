"use client";

import type { OnboardingSection } from "@devdigest/shared";
import { Markdown } from "@devdigest/ui";
import { CopyControl } from "./CopyControl";
import { SECTION_ANCHORS, SECTION_ICONS } from "./constants";
import { SectionCard } from "./SectionCard";
import { s } from "./styles";

export function LocalSetupSection({
  section,
  commandsLabel,
  envLabel,
  envEmpty,
  commandsEmpty,
  copyIdle,
  copied,
  copyFailed,
}: {
  section: OnboardingSection;
  commandsLabel: string;
  envLabel: string;
  envEmpty: string;
  commandsEmpty: string;
  copyIdle: string;
  copied: string;
  copyFailed: string;
}) {
  const commands = section.commands ?? [];
  const envVars = section.env_vars ?? [];
  return (
    <SectionCard
      id={SECTION_ANCHORS.local_setup}
      title={section.title}
      icon={SECTION_ICONS.local_setup}
    >
      <Markdown>{section.body}</Markdown>
      <div style={s.layoutTitle}>{commandsLabel}</div>
      {commands.length === 0 ? <p style={s.emptyIn}>{commandsEmpty}</p> : null}
      {commands.map((cmd, i) => (
        <div key={`${cmd}-${i}`} style={s.cmdRow}>
          <code className="mono" style={s.cmd}>
            {cmd}
          </code>
          <CopyControl text={cmd} idle={copyIdle} copied={copied} failed={copyFailed} />
        </div>
      ))}
      <div style={s.layoutTitle}>{envLabel}</div>
      {envVars.length === 0 ? (
        <p style={s.emptyIn}>{envEmpty}</p>
      ) : (
        <ul style={s.envList}>
          {envVars.map((name) => (
            <li key={name} className="mono">
              {name}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
