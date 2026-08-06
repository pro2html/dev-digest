/* ImportSkillDrawer — .md-only import with client-side preview before POST. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Drawer, FormField, TextInput, SelectInput, Markdown } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useImportSkill } from "../../../../../../lib/hooks/skills";
import { useToast } from "../../../../../../lib/toast";
import { firstHeading, isMarkdownFile, readFileText } from "@/components/SkillBodyEditor";
import { DRAWER_WIDTH, SKILL_TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

export function ImportSkillDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const importSkill = useImportSkill();
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<SkillType>("custom");
  const [body, setBody] = React.useState("");
  const [fileError, setFileError] = React.useState<string | null>(null);

  const typeOptions = SKILL_TYPE_OPTIONS.map((v) => ({
    value: v,
    label: t(`listItem.type.${v}`),
  }));

  const hasPreview = body.length > 0;

  const onFileChange = async (file: File | null) => {
    setFileError(null);
    if (!file) return;
    if (!isMarkdownFile(file)) {
      setFileError(t("file.onlyMd"));
      setBody("");
      return;
    }
    const text = await readFileText(file);
    setBody(text);
    const heading = firstHeading(text);
    if (heading) setName(heading);
  };

  const submit = async () => {
    if (!body.trim()) return;
    const skill = await importSkill.mutateAsync({
      name: name.trim() || undefined,
      type,
      body,
    });
    toast.success(t("file.success", { name: skill.name }));
    onClose();
    router.push(`/skills/${skill.id}?tab=config`);
  };

  return (
    <Drawer
      width={DRAWER_WIDTH}
      title={t("drawer.title")}
      subtitle={t("file.pickFile")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button
            kind="primary"
            icon="Upload"
            onClick={submit}
            disabled={!hasPreview || importSkill.isPending}
          >
            {importSkill.isPending ? t("file.importing") : t("file.import")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.dropZone}>
          <Button kind="secondary" size="sm" icon="File" onClick={() => fileRef.current?.click()}>
            {t("file.pickFile")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            style={s.fileInput}
            onChange={(e) => void onFileChange(e.target.files?.[0] ?? null)}
          />
          {fileError && <div style={s.error}>{fileError}</div>}
        </div>

        {hasPreview && (
          <>
            <div style={s.warning}>{t("file.trustWarning")}</div>
            <FormField label={t("file.nameLabel")} hint={t("file.nameHint")}>
              <TextInput value={name} onChange={setName} placeholder={t("file.namePlaceholder")} />
            </FormField>
            <FormField label={t("file.typeLabel")}>
              <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
            </FormField>
            <div>
              <div style={s.previewHeading}>{t("file.previewTitle")}</div>
              <div style={s.previewCard}>
                <Markdown>{body}</Markdown>
              </div>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
