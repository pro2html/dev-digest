/**
 * Onboarding writer — LLM structured output schema.
 *
 * Stricter than the HTTP envelope: layout/flows/complexity are present at
 * write time. Optional fields are `.nullable()` so OpenAI strict json_schema
 * still lists them. Recursive `z.lazy` is avoided here (bounded layout depth).
 */
import { z } from 'zod';
import { TaskComplexity } from '@devdigest/shared';

const LayoutLeaf = z.object({
  name: z.string(),
  children: z.array(z.object({ name: z.string() })).nullable(),
});

const LayoutMid = z.object({
  name: z.string(),
  children: z.array(LayoutLeaf).nullable(),
});

export const OnboardingLlmLayout = z.object({
  name: z.string(),
  children: z.array(LayoutMid).nullable(),
});

const LlmLink = z.object({
  label: z.string(),
  path: z.string(),
  note: z.string().nullable(),
});

const LlmFlowStep = z.object({
  label: z.string(),
  path: z.string().nullable(),
});

const LlmFlow = z.object({
  title: z.string(),
  steps: z.array(LlmFlowStep).min(1),
});

const LlmTask = z.object({
  title: z.string(),
  path: z.string().nullable(),
  complexity: TaskComplexity,
});

export const OnboardingLlmSection = z.object({
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  diagram: z.string().nullable(),
  links: z.array(LlmLink),
  layout: OnboardingLlmLayout.nullable(),
  flows: z.array(LlmFlow).nullable(),
  commands: z.array(z.string()).nullable(),
  env_vars: z.array(z.string()).nullable(),
  tasks: z.array(LlmTask).nullable(),
});

export const OnboardingLlmOutput = z.object({
  sections: z.array(OnboardingLlmSection),
});
export type OnboardingLlmOutput = z.infer<typeof OnboardingLlmOutput>;
export type OnboardingLlmSection = z.infer<typeof OnboardingLlmSection>;
