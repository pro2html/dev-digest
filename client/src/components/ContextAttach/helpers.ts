import type { ContextCatalogFile } from "@devdigest/shared";

export function fileName(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(i + 1) : path;
}

/** Directory prefix with trailing slash, or empty for a top-level file. */
export function dirPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i >= 0 ? path.slice(0, i + 1) : "";
}

export function matchesFilter(path: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return path.toLowerCase().includes(q) || fileName(path).toLowerCase().includes(q);
}

export function reorderPaths(paths: readonly string[], fromPath: string, toPath: string): string[] {
  const from = paths.indexOf(fromPath);
  const to = paths.indexOf(toPath);
  if (from < 0 || to < 0 || from === to) return [...paths];
  const next = [...paths];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function unionEffectivePaths(agentPaths: readonly string[], inheritedGroups: readonly string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of agentPaths) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  for (const group of inheritedGroups) {
    for (const p of group) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

export function catalogByPath(files: readonly ContextCatalogFile[]): Map<string, ContextCatalogFile> {
  return new Map(files.map((f) => [f.path, f]));
}
