---
title: Split Components by Single Responsibility
impact: CRITICAL
impactDescription: Splitting by line count creates sprawl; keeping multiple reasons to change in one file makes every edit risky
tags: components, srp, splitting, change-isolation
---

## Split Components by Single Responsibility

Split when a component has **more than one reason to change** (API shape, design, business rule, navigation), not when it exceeds an arbitrary line count. A long file with one clear job is fine. A short file with four jobs is not.

**Change-isolation test:** For each concern (API, UI design, domain rule, routing), ask "If X changes, must this file change?" More than ~2 yeses → candidate for a split. Prefer extracting hooks/services **before** splitting JSX.

**Incorrect (many responsibilities, "small" file):**

```tsx
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then((r) => r.json()).then(setUser);
    fetch(`/api/users/${userId}/activity`).then((r) => r.json()).then(setActivity);
  }, [userId]);

  async function rename(name: string) {
    await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
    setUser((u) => (u ? { ...u, name } : u));
  }

  if (!user) return <p>Loading…</p>;
  return (
    <section>
      <h1>{user.name}</h1>
      <button onClick={() => rename(prompt('Name') ?? user.name)}>Edit</button>
      <ul>{activity.map((a) => <li key={a.id}>{a.label}</li>)}</ul>
      <a href="/settings">Settings</a>
    </section>
  );
}
```

Fetch, mutation, activity list, and navigation all live here — four reasons to change.

**Correct (split along responsibilities):**

```tsx
// hooks/useUserProfile.ts   — user data + rename mutation
// hooks/useUserActivity.ts  — activity data (separate reason to change)
// UserProfileCard.tsx       — presentational
// UserActivityList.tsx      — presentational

// UserProfilePage.tsx — composition only
function UserProfilePage({ userId }: { userId: string }) {
  const { user, rename } = useUserProfile(userId);
  const { activity } = useUserActivity(userId);
  if (!user) return <p>Loading…</p>;
  return (
    <>
      <UserProfileCard user={user} onRename={rename} />
      <UserActivityList items={activity} />
      <Link href="/settings">Settings</Link>
    </>
  );
}
```

**When NOT to use this pattern:**
- Extracting one-off JSX into a component "for reuse someday" with no second consumer
- Splitting pieces that always change together — keep them colocated

Reference: [When to Split a React Component](https://dev.to/137foundry/when-to-split-a-react-component-and-when-youre-over-engineering-2a6e)
