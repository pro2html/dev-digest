import type { OnboardingSection, OnboardingTour } from "@devdigest/shared";
import type { TourSectionKind } from "./constants";

export function isEmptyTour(tour: OnboardingTour | undefined): boolean {
  return !tour || tour.generated_at == null || tour.sections.length === 0;
}

export function relativeGeneratedTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "—";
  const m = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function sectionByKind(
  sections: OnboardingSection[],
  kind: TourSectionKind,
): OnboardingSection | undefined {
  return sections.find((s) => s.kind === kind);
}

export function repoShortName(
  repo: { name?: string; full_name?: string } | null | undefined,
  fallback: string,
): string {
  if (repo?.name) return repo.name;
  const full = repo?.full_name;
  if (full?.includes("/")) return full.slice(full.lastIndexOf("/") + 1);
  return full || fallback;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
