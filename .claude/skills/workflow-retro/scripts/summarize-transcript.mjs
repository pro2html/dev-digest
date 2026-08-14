#!/usr/bin/env node
/**
 * Summarize a Cursor parent transcript + its subagents.
 *
 * Usage:
 *   node summarize-transcript.mjs <session-id>
 *   node summarize-transcript.mjs /path/to/parent.jsonl
 *   node summarize-transcript.mjs --latest
 *
 * Prints JSON to stdout. Token figures are chars/4 estimates, not billed usage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DUMP_CHARS = 2000;
const PROMPT_PREFIX = 120;
const MUTATE = new Set(['Write', 'StrReplace', 'Edit', 'Delete']);
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);

function repoSlug(cwd) {
  const abs = path.resolve(cwd);
  return abs.replace(/^[/\\]/, '').replace(/[/\\]/g, '-');
}

function transcriptsRoot(cwd) {
  const slug = repoSlug(cwd);
  const primary = path.join(os.homedir(), '.cursor', 'projects', slug, 'agent-transcripts');
  if (fs.existsSync(primary)) return primary;
  const projects = path.join(os.homedir(), '.cursor', 'projects');
  if (!fs.existsSync(projects)) {
    throw new Error(`No transcripts dir: ${primary}`);
  }
  const hits = fs.readdirSync(projects).filter((d) => {
    return fs.existsSync(path.join(projects, d, 'agent-transcripts'));
  });
  if (hits.length === 1) {
    return path.join(projects, hits[0], 'agent-transcripts');
  }
  throw new Error(
    `No transcripts at ${primary}. Candidates: ${hits.join(', ') || '(none)'}`,
  );
}

function readJsonl(file) {
  if (!fs.existsSync(file)) return [];
  const raw = fs.readFileSync(file, 'utf8');
  const records = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch {
      // skip truncated last line
    }
  }
  return records;
}

function fileChars(file) {
  if (!fs.existsSync(file)) return 0;
  return fs.statSync(file).size;
}

function estimateTokens(chars) {
  return Math.round(chars / 4);
}

function walkContent(content, visit) {
  if (!content) return;
  const items = Array.isArray(content) ? content : [content];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    visit(item);
    if (item.message?.content) walkContent(item.message.content, visit);
    if (item.content) walkContent(item.content, visit);
  }
}

function extractText(content) {
  const parts = [];
  walkContent(content, (item) => {
    if (item.type === 'text' && typeof item.text === 'string') parts.push(item.text);
    else if (typeof item.text === 'string' && !item.type) parts.push(item.text);
  });
  return parts.join('\n');
}

function parseTimestamp(text) {
  const m = text.match(/<timestamp>([^<]+)<\/timestamp>/i);
  if (!m) return null;
  const cleaned = m[1].replace(/\(([^)]+)\)/, '$1').trim();
  const ms = Date.parse(cleaned);
  return Number.isNaN(ms) ? { raw: m[1], ms: null } : { raw: m[1], ms };
}

function collectTimestamps(records) {
  const out = [];
  for (const rec of records) {
    const text = extractText(rec.message?.content ?? rec.content);
    const ts = parseTimestamp(text);
    if (ts) out.push(ts);
  }
  return out;
}

function collectTools(records) {
  const tools = [];
  for (const rec of records) {
    const content = rec.message?.content ?? rec.content;
    walkContent(content, (item) => {
      if (item.type === 'tool_use' && item.name) {
        tools.push({ name: item.name, input: item.input ?? {} });
      }
    });
  }
  return tools;
}

function toolPath(input) {
  return input?.path || input?.target_notebook || input?.file_path || null;
}

function pathsOf(tools, names) {
  const set = new Set();
  for (const t of tools) {
    if (!names.has(t.name)) continue;
    const p = toolPath(t.input);
    if (p) set.add(p);
  }
  return [...set];
}

function firstUserText(records) {
  for (const rec of records) {
    if (rec.role === 'user') return extractText(rec.message?.content ?? rec.content);
  }
  return '';
}

function wallClock(timestamps) {
  const withMs = timestamps.filter((t) => t.ms != null);
  if (withMs.length < 2) {
    return {
      first: timestamps[0]?.raw ?? null,
      last: timestamps[timestamps.length - 1]?.raw ?? null,
      durationMs: null,
    };
  }
  const first = withMs[0];
  const last = withMs[withMs.length - 1];
  return {
    first: first.raw,
    last: last.raw,
    durationMs: last.ms - first.ms,
  };
}

function resolveParentJsonl(arg, root) {
  if (arg === '--latest') {
    const sessions = fs
      .readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => {
        const jsonl = path.join(root, d.name, `${d.name}.jsonl`);
        const st = fs.existsSync(jsonl) ? fs.statSync(jsonl) : null;
        return { id: d.name, jsonl, mtime: st?.mtimeMs ?? 0 };
      })
      .filter((s) => s.mtime > 0)
      .sort((a, b) => b.mtime - a.mtime);
    if (!sessions[0]) throw new Error(`No sessions in ${root}`);
    return sessions[0];
  }
  if (arg.endsWith('.jsonl') || arg.includes(path.sep) || arg.startsWith('/')) {
    const jsonl = path.resolve(arg);
    const id = path.basename(jsonl, '.jsonl');
    return { id, jsonl, mtime: fs.statSync(jsonl).mtimeMs };
  }
  const jsonl = path.join(root, arg, `${arg}.jsonl`);
  if (!fs.existsSync(jsonl)) throw new Error(`Session not found: ${jsonl}`);
  return { id: arg, jsonl, mtime: fs.statSync(jsonl).mtimeMs };
}

function loadSubagents(sessionDir) {
  const dir = path.join(sessionDir, 'subagents');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const jsonl = path.join(dir, f);
      const id = f.replace(/\.jsonl$/, '');
      const records = readJsonl(jsonl);
      const tools = collectTools(records);
      return {
        id,
        jsonl,
        chars: fileChars(jsonl),
        records,
        tools,
        firstUser: firstUserText(records),
        timestamps: collectTimestamps(records),
        mutatePaths: pathsOf(tools, MUTATE),
        readPaths: pathsOf(tools, READ_TOOLS),
      };
    });
}

function matchSubagent(launch, subagents, used) {
  if (launch.resume) {
    const hit = subagents.find((s) => s.id === launch.resume);
    if (hit) return hit;
  }
  const prefix = launch.promptPrefix ?? '';
  if (!prefix) return null;
  const hit = subagents.find((s) => !used.has(s.id) && s.firstUser.includes(prefix));
  return hit ?? null;
}

function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      'Usage: summarize-transcript.mjs <session-id | parent.jsonl | --latest>',
    );
    process.exit(2);
  }

  const cwd = process.cwd();
  const root = transcriptsRoot(cwd);
  const session = resolveParentJsonl(arg, root);
  const sessionDir = path.dirname(session.jsonl);
  const parentRecords = readJsonl(session.jsonl);
  const parentTools = collectTools(parentRecords);
  const parentTs = collectTimestamps(parentRecords);

  const launches = [];
  const parallelGroups = [];

  for (const rec of parentRecords) {
    const content = rec.message?.content ?? rec.content;
    const tasksInMsg = [];
    walkContent(content, (item) => {
      if (item.type === 'tool_use' && item.name === 'Task') {
        tasksInMsg.push(item.input ?? {});
      }
    });
    if (tasksInMsg.length === 0) continue;
    const groupIdx = [];
    const parallel = tasksInMsg.length > 1;
    for (const input of tasksInMsg) {
      const prompt = typeof input.prompt === 'string' ? input.prompt : '';
      const idx = launches.length;
      launches.push({
        index: idx,
        subagentType: input.subagent_type ?? null,
        description: input.description ?? null,
        resume: input.resume ?? null,
        model: input.model ?? null,
        promptChars: prompt.length,
        promptPrefix: prompt.slice(0, PROMPT_PREFIX),
        dumpSuspect: prompt.length >= DUMP_CHARS,
        parallel,
        subagentId: null,
      });
      groupIdx.push(idx);
    }
    if (parallel) parallelGroups.push(groupIdx);
  }

  const subagents = loadSubagents(sessionDir);
  const used = new Set();
  for (const launch of launches) {
    const sub = matchSubagent(launch, subagents, used);
    if (sub) {
      used.add(sub.id);
      launch.subagentId = sub.id;
      launch.tokenEstimate = estimateTokens(sub.chars);
      launch.wallClock = wallClock(sub.timestamps);
      launch.mutatePaths = sub.mutatePaths.slice(0, 30);
      launch.readPaths = sub.readPaths.slice(0, 30);
      launch.toolCounts = countBy(sub.tools.map((t) => t.name));
    } else {
      launch.tokenEstimate = estimateTokens(launch.promptChars);
      launch.wallClock = { first: null, last: null, durationMs: null };
      launch.mutatePaths = [];
      launch.readPaths = [];
      launch.toolCounts = {};
    }
  }

  for (const launch of launches) {
    if (launch.subagentType || !launch.resume) continue;
    const prev = launches.find(
      (l) => l.subagentId === launch.resume && l.subagentType,
    );
    if (prev) launch.subagentType = prev.subagentType;
  }

  const unmatched = subagents.filter((s) => !used.has(s.id)).map((s) => ({
    id: s.id,
    tokenEstimate: estimateTokens(s.chars),
    mutatePaths: s.mutatePaths,
  }));

  const parentReads = pathsOf(parentTools, READ_TOOLS);
  const firstTaskIdx = parentTools.findIndex((t) => t.name === 'Task');
  const toolsAfterFirstTask =
    firstTaskIdx >= 0 ? parentTools.slice(firstTaskIdx + 1) : [];
  const parentWritesAfterTask = pathsOf(toolsAfterFirstTask, MUTATE);
  const parentTakeover = parentWritesAfterTask.length > 0;

  const childMutate = new Map();
  for (const launch of launches) {
    const label = `${launch.subagentType ?? 'unknown'}#${launch.index}`;
    const ownerId = launch.subagentId ?? `launch-${launch.index}`;
    for (const p of launch.mutatePaths ?? []) {
      if (!childMutate.has(p)) childMutate.set(p, []);
      childMutate.get(p).push({ label, ownerId });
    }
  }
  const fileOverlap = [...childMutate.entries()]
    .map(([file, owners]) => {
      const unique = [...new Map(owners.map((o) => [o.ownerId, o.label])).entries()];
      return { file, owners: unique.map(([, label]) => label), ownerCount: unique.length };
    })
    .filter((row) => row.ownerCount > 1)
    .map(({ file, owners }) => ({ file, owners }));

  const childReads = new Set(launches.flatMap((l) => l.readPaths ?? []));
  const duplicateReads = parentReads.filter((p) => childReads.has(p)).slice(0, 40);

  const parentChars = fileChars(session.jsonl);
  const childChars = subagents.reduce((n, s) => n + s.chars, 0);

  const uniqueTypes = [
    ...new Set(launches.map((l) => l.subagentType).filter(Boolean)),
  ];

  const out = {
    sessionId: session.id,
    parentJsonl: session.jsonl,
    method: 'chars/4 over transcript files (estimate, not billed usage)',
    dumpThresholdChars: DUMP_CHARS,
    tokenEstimate: {
      parent: estimateTokens(parentChars),
      children: estimateTokens(childChars),
      total: estimateTokens(parentChars + childChars),
    },
    wallClock: wallClock(parentTs),
    agentLaunches: launches.length,
    uniqueAgentTypes: uniqueTypes,
    resumeCount: launches.filter((l) => l.resume).length,
    parentTakeover,
    parentWritesAfterTask: parentWritesAfterTask.slice(0, 40),
    launches,
    parallelGroups,
    fileOverlap,
    duplicateReads,
    unmatchedSubagents: unmatched,
  };

  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
}

function countBy(names) {
  const m = {};
  for (const n of names) m[n] = (m[n] ?? 0) + 1;
  return m;
}

main();
