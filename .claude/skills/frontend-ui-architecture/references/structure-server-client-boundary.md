---
title: Place the Server/Client Boundary Deliberately
impact: HIGH
impactDescription: Marking large trees with 'use client' pulls unnecessary modules into the client bundle and blurs architectural ownership
tags: structure, nextjs, rsc, use-client, boundary
---

## Place the Server/Client Boundary Deliberately

Default to Server Components. Add `'use client'` only at the **leaves** that need browser APIs, event handlers, or React state. Fetch and orchestrate data in Server Components (or loaders) and pass results down as props.

This rule is about **where responsibility lives**. For the mechanics — serializable props, async client components, Server Action rules — use `next-best-practices`.

**Incorrect (boundary too high):**

```tsx
// app/dashboard/page.tsx
'use client'; // entire page becomes the client graph

export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/report').then((r) => r.json()).then(setData);
  }, []);
  return <HeavyReportTable data={data} format={formatMoney} />;
}
```

Every module this file imports is now part of the client bundle, and data fetching has moved from the server into a round trip after hydration.

**Correct (server parent owns data, client leaf owns interaction):**

```tsx
// app/dashboard/page.tsx — Server Component (default)
import { getReport } from './_lib/queries';
import { ReportTable } from './_components/ReportTable';
import { FilterBar } from './_components/FilterBar'; // 'use client' inside

export default async function DashboardPage() {
  const data = await getReport();
  return (
    <>
      <FilterBar />
      <ReportTable data={data} />
    </>
  );
}
```

**Rules:**
- `'use client'` marks the **entry** of the client graph — everything it imports ships to the client
- A Client Component cannot import a Server Component, but it can receive server-rendered output through `children`
- Mutations go through Server Actions; external/REST consumers need Route Handlers

**When NOT to use this pattern:**
- Highly interactive islands that must own their own client fetching (live chat, collaborative editors) — still keep the island small
- Non-Next React SPAs — apply the same idea as "container owns data, leaf owns interaction"

Reference: [Next.js — Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
