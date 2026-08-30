"use client";

import { useParams } from "next/navigation";
import { ResultsView } from "../_components/ResultsView";

export default function MultiAgentResultsPage() {
  const params = useParams<{ repoId: string; prId: string }>();
  return <ResultsView repoId={params.repoId} prId={params.prId} />;
}
