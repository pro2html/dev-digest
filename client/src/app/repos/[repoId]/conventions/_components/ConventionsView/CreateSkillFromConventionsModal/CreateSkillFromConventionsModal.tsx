"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Modal,
  Button,
  FormField,
  TextInput,
  SelectInput,
  SearchableSelect,
  Toggle,
  Icon,
} from "@devdigest/ui";
import type { SkillType, ConventionCandidate } from "@devdigest/shared";
import {
  useConventionSkillDraft,
  useCreateSkillFromConventions,
} from "@/lib/hooks/conventions";
import { useAgents } from "@/lib/hooks/agents";
import { SkillBodyEditor, skillSlug } from "@/components/SkillBodyEditor";
import { s } from "./styles";

const SKILL_TYPE_OPTIONS: readonly SkillType[] = [
  "custom",
  "rubric",
  "convention",
  "security",
];

interface Props {
  repoId: string;
  repoName: string;
  accepted: ConventionCandidate[];
  onClose: () => void;
}

export function CreateSkillFromConventionsModal({
  repoId,
  repoName,
  accepted,
  onClose,
}: Props) {
  const t = useTranslations("conventions");
  const router = useRouter();
  const draft = useConventionSkillDraft(repoId);
  const create = useCreateSkillFromConventions(repoId);
  const { data: agents } = useAgents();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("convention");
  const [body, setBody] = React.useState("");
  const [originalBody, setOriginalBody] = React.useState("");
  const [enabled, setEnabled] = React.useState(true);
  const [agentId, setAgentId] = React.useState("");
  const [loaded, setLoaded] = React.useState(false);

  const ids = React.useMemo(() => accepted.map((c) => c.id), [accepted]);

  React.useEffect(() => {
    if (ids.length > 0 && !loaded) {
      draft.mutate(ids, {
        onSuccess: (d) => {
          setName(d.name);
          setDescription(d.description);
          setType(d.type);
          setBody(d.body);
          setOriginalBody(d.body);
          setLoaded(true);
        },
      });
    }
  }, [ids.length]);

  const typeOptions = SKILL_TYPE_OPTIONS.map((v) => ({
    value: v,
    label: v.charAt(0).toUpperCase() + v.slice(1),
  }));

  const agentOptions = [
    { value: "", label: t("modal.linkAgentPlaceholder") },
    ...(agents ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  const submit = async () => {
    const skill = await create.mutateAsync({
      ids,
      name: name.trim(),
      description,
      type,
      body,
      enabled,
      agent_id: agentId || undefined,
    });
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  const isLoading = draft.isPending && !loaded;

  return (
    <Modal
      width={720}
      title={t("modal.title")}
      subtitle={name || t("modal.subtitle", { n: accepted.length })}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <span style={s.footerCaption}>{t("modal.savedAs")}</span>
          <div style={s.footerActions}>
            <Button kind="ghost" onClick={onClose}>
              {t("modal.cancel")}
            </Button>
            <Button
              kind="primary"
              icon="Sparkles"
              onClick={submit}
              disabled={create.isPending || isLoading || !name.trim()}
            >
              {create.isPending ? "…" : t("modal.create")}
            </Button>
          </div>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.banner}>
          <Icon.Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{t("modal.banner", { n: accepted.length, repo: repoName })}</span>
        </div>

        {isLoading ? (
          <p style={s.loading}>{t("modal.loadingDraft")}</p>
        ) : (
          <>
            <FormField label={t("modal.name")} required>
              <TextInput value={name} onChange={setName} mono />
            </FormField>

            <FormField label={t("modal.description")}>
              <TextInput value={description} onChange={setDescription} />
            </FormField>

            <FormField label={t("modal.type")}>
              <SelectInput
                value={type}
                onChange={(v) => setType(v as SkillType)}
                options={typeOptions}
              />
            </FormField>

            <FormField label={t("modal.enabled")}>
              <div style={s.enabledRow}>
                <Toggle on={enabled} onChange={setEnabled} />
                <span style={s.enabledCaption}>{t("modal.enabledCaption")}</span>
              </div>
            </FormField>

            <FormField label={t("modal.linkAgent")}>
              <SearchableSelect
                value={agentId}
                onChange={setAgentId}
                options={agentOptions}
                placeholder={t("modal.linkAgentPlaceholder")}
              />
            </FormField>

            <FormField label={t("modal.skillBody")} required>
              <SkillBodyEditor
                value={body}
                onChange={setBody}
                fileName={`${skillSlug(name || "skill")}.md`}
                dirty={body !== originalBody}
                rows={12}
              />
            </FormField>
          </>
        )}
      </div>
    </Modal>
  );
}
