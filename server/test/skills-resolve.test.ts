import { describe, it, expect } from 'vitest';
import {
  resolveSkillBodiesForPrompt,
  skillBodiesToAssembly,
  nameFromImportedMarkdown,
} from '../src/modules/skills/helpers.js';

/**
 * Unit coverage for skill → prompt resolve: only globally-enabled +
 * link-enabled skills, in `order`, prefixed with ### name; empty → null slot.
 */

describe('resolveSkillBodiesForPrompt', () => {
  const sources = [
    {
      name: 'second',
      body: 'body-2',
      skillEnabled: true,
      linkEnabled: true,
      order: 1,
    },
    {
      name: 'first',
      body: 'body-1',
      skillEnabled: true,
      linkEnabled: true,
      order: 0,
    },
    {
      name: 'globally-off',
      body: 'nope',
      skillEnabled: false,
      linkEnabled: true,
      order: 2,
    },
    {
      name: 'link-off',
      body: 'nope',
      skillEnabled: true,
      linkEnabled: false,
      order: 3,
    },
  ];

  it('keeps only both-enabled skills, sorted by order, prefixed with ### name', () => {
    const bodies = resolveSkillBodiesForPrompt(sources);
    expect(bodies).toEqual(['### first\nbody-1', '### second\nbody-2']);
  });

  it('excludes a globally disabled skill from prompt_assembly.skills', () => {
    const bodies = resolveSkillBodiesForPrompt([
      { name: 'off', body: 'x', skillEnabled: false, linkEnabled: true, order: 0 },
    ]);
    expect(skillBodiesToAssembly(bodies)).toBeNull();
  });

  it('returns null assembly when no skills qualify', () => {
    expect(skillBodiesToAssembly(resolveSkillBodiesForPrompt([]))).toBeNull();
    expect(
      skillBodiesToAssembly(
        resolveSkillBodiesForPrompt([
          { name: 'a', body: 'x', skillEnabled: true, linkEnabled: false, order: 0 },
        ]),
      ),
    ).toBeNull();
  });

  it('joins multiple bodies with blank lines for prompt_assembly.skills', () => {
    const bodies = resolveSkillBodiesForPrompt([
      { name: 'a', body: 'A', skillEnabled: true, linkEnabled: true, order: 0 },
      { name: 'b', body: 'B', skillEnabled: true, linkEnabled: true, order: 1 },
    ]);
    expect(skillBodiesToAssembly(bodies)).toBe('### a\nA\n\n### b\nB');
  });
});

describe('nameFromImportedMarkdown', () => {
  it('takes the first # heading', () => {
    expect(nameFromImportedMarkdown('# My Skill\n\nbody')).toBe('My Skill');
  });

  it('falls back when no heading is present', () => {
    expect(nameFromImportedMarkdown('just text')).toBe('imported-skill');
  });
});
