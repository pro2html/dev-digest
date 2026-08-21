"use client";

import { useParams } from "next/navigation";
import { ContextView } from "./_components/ContextView";

export default function ProjectContextPage() {
  const params = useParams<{ repoId: string }>();
  return <ContextView repoId={params.repoId} />;
}
