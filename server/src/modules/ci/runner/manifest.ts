import { AgentManifest, type AgentManifest as AgentManifestType } from '@devdigest/shared';
import { parseSimpleYaml } from './yaml.js';

export interface ExportedManifest {
  manifest: AgentManifestType;
  exportedVersion: string | undefined;
}

/**
 * Validate exported agent YAML with the same server `AgentManifest` Zod object
 * the studio uses (`eval-ci.ts` / `AgentManifest.parse`). Fail closed.
 */
export function parseExportedManifest(raw: string): ExportedManifest {
  const parsed = AgentManifest.safeParse(parseSimpleYaml(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join('.') : 'manifest';
    throw new Error(`invalid_manifest: ${path}`);
  }
  const ver = String(raw).match(/# exported_agent_version:\s*(\S+)/);
  return { manifest: parsed.data, exportedVersion: ver?.[1] };
}
