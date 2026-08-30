/**
 * YAML → object for the AgentManifest subset the studio emits (`manifestToYaml`).
 * This is deserialization only — schema validation is `AgentManifest.parse`.
 */
export function parseSimpleYaml(src: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const lines = src.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1]!;
    const rest = m[2]!;
    if (rest === '|') {
      const block: string[] = [];
      i += 1;
      while (i < lines.length && (lines[i]!.startsWith('  ') || lines[i] === '')) {
        block.push(lines[i]!.startsWith('  ') ? lines[i]!.slice(2) : '');
        i += 1;
      }
      out[key] = block.join('\n').replace(/\n$/, '');
      continue;
    }
    if (rest === '[]' || rest === '') {
      if (rest === '[]') {
        out[key] = [];
        i += 1;
        continue;
      }
      const items: string[] = [];
      i += 1;
      while (i < lines.length && /^\s+-\s+/.test(lines[i]!)) {
        const raw = lines[i]!.replace(/^\s+-\s+/, '');
        items.push(unquote(raw));
        i += 1;
      }
      out[key] = items;
      continue;
    }
    out[key] = unquote(rest);
    i += 1;
  }
  return out;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    try {
      return JSON.parse(s.startsWith("'") ? `"${s.slice(1, -1)}"` : s) as string;
    } catch {
      return s.slice(1, -1);
    }
  }
  return s;
}
