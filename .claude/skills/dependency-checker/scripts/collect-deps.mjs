#!/usr/bin/env node
/**
 * Collect first-party package dependency facts for dependency-checker.
 *
 * Usage:
 *   node collect-deps.mjs [--root PATH] [--package DIR] [--no-sizes]
 *
 * Prints JSON to stdout. Sizes are local installed bytes (du), not registry
 * unpackedSize. Does not npm-install or parse lockfile graphs.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.next',
  'fixtures',
  'vendor',
  '.git',
  '.claude',
  '.cursor',
  '.turbo',
]);

const KIND_FIELDS = [
  ['dependencies', 'dependencies'],
  ['devDependencies', 'devDependencies'],
  ['peerDependencies', 'peerDependencies'],
  ['optionalDependencies', 'optionalDependencies'],
];

function parseArgs(argv) {
  const out = { root: null, packageDir: null, sizes: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') out.root = argv[++i];
    else if (a === '--package') out.packageDir = argv[++i];
    else if (a === '--no-sizes') out.sizes = false;
    else if (a === '--help' || a === '-h') {
      console.error(
        'Usage: node collect-deps.mjs [--root PATH] [--package DIR] [--no-sizes]',
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${a}`);
    }
  }
  return out;
}

function findRepoRoot(start) {
  let dir = path.resolve(start);
  while (true) {
    const agents = path.join(dir, 'AGENTS.md');
    const compose = path.join(dir, 'docker-compose.yml');
    if (fs.existsSync(agents) && fs.existsSync(compose)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find repo root (AGENTS.md + docker-compose.yml) from ${start}`,
      );
    }
    dir = parent;
  }
}

function human(bytes) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function duBytes(dir, follow) {
  if (!fs.existsSync(dir)) return null;
  const attempts = follow
    ? [
        ['-skL', dir],
        ['-sk', '--dereference', dir],
      ]
    : [['-sk', dir]];
  for (const args of attempts) {
    try {
      const out = execFileSync('du', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const kb = parseInt(out.trim().split(/\s+/)[0], 10);
      if (Number.isFinite(kb)) return kb * 1024;
    } catch {
      /* try next */
    }
  }
  return null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listLockfiles(pkgDir) {
  const names = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock', 'bun.lockb'];
  return names.filter((n) => fs.existsSync(path.join(pkgDir, n)));
}

function readTsconfigPaths(pkgDir) {
  const file = path.join(pkgDir, 'tsconfig.json');
  if (!fs.existsSync(file)) return [];
  let json;
  try {
    json = readJson(file);
  } catch {
    return [{ error: `unparseable tsconfig: ${path.relative(process.cwd(), file)}` }];
  }
  const paths = json?.compilerOptions?.paths;
  if (!paths || typeof paths !== 'object') return [];
  return Object.entries(paths).map(([alias, targets]) => ({
    alias,
    targets: Array.isArray(targets) ? targets : [String(targets)],
  }));
}

function walkPackageDirs(root) {
  const found = [];
  const rootPkg = path.join(root, 'package.json');
  if (fs.existsSync(rootPkg)) found.push(root);

  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const dir = path.join(root, e.name);
    if (fs.existsSync(path.join(dir, 'package.json'))) found.push(dir);
  }
  return found.sort();
}

function declaredDeps(pkgJson) {
  const deps = [];
  for (const [field, kind] of KIND_FIELDS) {
    const bag = pkgJson[field];
    if (!bag || typeof bag !== 'object') continue;
    for (const [name, spec] of Object.entries(bag)) {
      deps.push({ name, spec: String(spec), kind });
    }
  }
  return deps;
}

function measureDep(pkgDir, name, sizes) {
  if (!sizes) return { localBytes: null, localHuman: null, resolvedPath: null };
  const link = path.join(pkgDir, 'node_modules', name);
  if (!fs.existsSync(link)) {
    return { localBytes: null, localHuman: null, resolvedPath: null };
  }
  let resolvedPath = link;
  try {
    resolvedPath = fs.realpathSync(link);
  } catch {
    /* keep link */
  }
  const bytes = duBytes(link, true);
  return {
    localBytes: bytes,
    localHuman: human(bytes),
    resolvedPath: path.relative(pkgDir, resolvedPath),
  };
}

function parseComposeImages(root) {
  const file = path.join(root, 'docker-compose.yml');
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const images = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*image:\s*(\S+)/);
    if (m) images.push(m[1].replace(/['"]/g, ''));
  }
  return images;
}

function rel(root, abs) {
  return path.relative(root, abs) || '.';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const inferred = args.root
    ? path.resolve(args.root)
    : findRepoRoot(process.cwd() === path.parse(process.cwd()).root ? scriptDir : process.cwd());
  const root = inferred;

  let dirs = walkPackageDirs(root);
  if (args.packageDir) {
    const want = args.packageDir.replace(/\/$/, '');
    dirs = dirs.filter((d) => {
      const r = rel(root, d);
      return r === want || path.basename(d) === want;
    });
    if (dirs.length === 0) {
      throw new Error(`No package matched --package ${args.packageDir}`);
    }
  }

  const packages = [];
  for (const dir of dirs) {
    const pkgJson = readJson(path.join(dir, 'package.json'));
    const lockfiles = listLockfiles(dir);
    const nmDir = path.join(dir, 'node_modules');
    const nodeModulesPresent = fs.existsSync(nmDir);
    const treeBytes = args.sizes && nodeModulesPresent ? duBytes(nmDir, false) : null;
    const deps = declaredDeps(pkgJson).map((d) => ({
      ...d,
      ...measureDep(dir, d.name, args.sizes && nodeModulesPresent),
    }));

    packages.push({
      dir: rel(root, dir),
      name: pkgJson.name ?? null,
      private: Boolean(pkgJson.private),
      engines: pkgJson.engines ?? null,
      lockfiles,
      mixedLockfile: lockfiles.includes('pnpm-lock.yaml') && lockfiles.includes('package-lock.json'),
      nodeModulesPresent,
      nodeModulesBytes: treeBytes,
      nodeModulesHuman: human(treeBytes),
      aliases: readTsconfigPaths(dir),
      depCounts: {
        dependencies: deps.filter((d) => d.kind === 'dependencies').length,
        devDependencies: deps.filter((d) => d.kind === 'devDependencies').length,
        peerDependencies: deps.filter((d) => d.kind === 'peerDependencies').length,
        optionalDependencies: deps.filter((d) => d.kind === 'optionalDependencies').length,
      },
      deps,
    });
  }

  const byName = new Map();
  for (const pkg of packages) {
    for (const d of pkg.deps) {
      if (!byName.has(d.name)) byName.set(d.name, []);
      byName.get(d.name).push({
        packageDir: pkg.dir,
        packageName: pkg.name,
        spec: d.spec,
        kind: d.kind,
        localBytes: d.localBytes,
      });
    }
  }

  const duplicated = [];
  const specDrift = [];
  for (const [name, instances] of [...byName.entries()].sort()) {
    if (instances.length < 2) continue;
    duplicated.push({
      name,
      consumerCount: instances.length,
      specs: [...new Set(instances.map((i) => i.spec))],
      instances,
    });
    const specs = new Set(instances.map((i) => i.spec));
    if (specs.size > 1) {
      specDrift.push({
        name,
        specs: [...specs],
        instances,
      });
    }
  }

  const combinedBytes = packages.reduce(
    (acc, p) => (p.nodeModulesBytes == null ? acc : (acc ?? 0) + p.nodeModulesBytes),
    null,
  );

  const hasLock = (pkg, name) => pkg.lockfiles.includes(name);
  const lockfileSummary = {
    pnpmOnly: packages
      .filter((p) => hasLock(p, 'pnpm-lock.yaml') && !hasLock(p, 'package-lock.json'))
      .map((p) => p.dir),
    npmOnly: packages
      .filter((p) => hasLock(p, 'package-lock.json') && !hasLock(p, 'pnpm-lock.yaml'))
      .map((p) => p.dir),
    mixed: packages.filter((p) => p.mixedLockfile).map((p) => p.dir),
    none: packages.filter((p) => p.lockfiles.length === 0).map((p) => p.dir),
  };

  const report = {
    ok: true,
    generatedAt: new Date().toISOString(),
    root,
    sizesMeasured: args.sizes,
    dockerImages: parseComposeImages(root),
    packageCount: packages.length,
    uniqueNpmNames: byName.size,
    combinedNodeModulesBytes: combinedBytes,
    combinedNodeModulesHuman: human(combinedBytes),
    mixedLockfileDirs: lockfileSummary.mixed,
    lockfileSummary,
    specDrift,
    duplicated: duplicated.sort((a, b) => b.consumerCount - a.consumerCount),
    packages,
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(1);
}
