#!/usr/bin/env node
/**
 * Asset-build for the Actions runner. Embeds server AgentManifest + reviewer-core
 * into a checked-in `assets/runner.mjs`. Do not run this on every preview request.
 *
 *   node src/modules/ci/runner/prebundle.mjs
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(here, '../../../..');
const entry = join(here, 'main.ts');
const outfile = join(here, '../assets/runner.mjs');
const shared = join(serverRoot, 'src/vendor/shared/index.ts');
const core = join(serverRoot, '../reviewer-core/src/index.ts');

const require = createRequire(join(serverRoot, 'node_modules/vite/package.json'));
const esbuild = require('esbuild');

await esbuild.build({
  absWorkingDir: serverRoot,
  entryPoints: [entry],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  outfile,
  legalComments: 'none',
  banner: {
    js: '#!/usr/bin/env node\n/* generated from modules/ci/runner — do not edit; rebuild via prebundle.mjs */',
  },
  alias: {
    '@devdigest/shared': shared,
    '@devdigest/reviewer-core': core,
  },
});

console.log(`wrote ${outfile}`);
