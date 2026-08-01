# Enforcing the Dependency Rule

Conventions drift. [`dependency-cruiser`](https://github.com/sverweij/dependency-cruiser)
turns the five layer rules into a CI graph check. This is a **template** —
rewrite `path` patterns to match the package's real folders (DevDigest
`server/src` uses `modules/`, `adapters/`, `platform/`, `db/`, not necessarily
`domain/` / `infrastructure/`).

Do not fetch external docs unless the user asks; adapt the template below.

## Template `.dependency-cruiser.cjs`

```js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-imports-nothing',
      severity: 'error',
      comment: 'Domain must not depend on any other layer',
      from: { path: '^src/domain' },
      to: { path: '^src/(application|infrastructure|presentation|adapters)' },
    },
    {
      name: 'application-no-infrastructure',
      severity: 'error',
      comment: 'Application may depend on Domain and Ports only',
      from: { path: '^src/(application|modules)' },
      to: { path: '^src/(infrastructure|adapters|db)' },
    },
    {
      name: 'application-no-presentation',
      severity: 'error',
      comment: 'Application must not know the delivery mechanism',
      from: { path: '^src/(application|modules)' },
      to: { path: '^src/presentation' },
    },
    {
      name: 'infrastructure-no-presentation',
      severity: 'error',
      comment: 'Adapters must not reach into routes/controllers',
      from: { path: '^src/(infrastructure|adapters|db)' },
      to: { path: '^src/presentation' },
    },
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'Cycles often mean a layer boundary was crossed both ways',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '(^|/)(__tests__|\\.test\\.|\\.it\\.test\\.)' },
  },
};
```

Composition-root exclusivity is hard to encode with a generic filename
convention — enforce it via review/checklist, or add a project-specific rule
once wiring lives in a known path (e.g. only `src/platform/` or `src/app.ts`
may import both modules and adapters).

## Scripts

```jsonc
{ "scripts": { "arch:check": "depcruise src --config .dependency-cruiser.cjs" } }
```

Run beside `typecheck`/`test` in CI. Optional complement:
`eslint-plugin-boundaries` for in-editor feedback.

## When to adopt

Only after folders already reflect a real layer split (not a single-file
prototype). Wrong paths produce noise, not safety.
