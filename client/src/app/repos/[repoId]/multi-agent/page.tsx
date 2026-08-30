"use client";

import { useParams } from "next/navigation";
import { ConfigureRunView } from "./_components/ConfigureRunView";

export default function MultiAgentConfigurePage() {
  const params = useParams<{ repoId: string }>();
  return <ConfigureRunView repoId={params.repoId} />;
}
