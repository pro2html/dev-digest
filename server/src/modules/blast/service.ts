/**
 * Blast service — compute-on-read from pr_files + repo-intel.
 * No LLM. Orchestrates getBlastRadius + reverse dependents + prior-PR overlap.
 */
import type { PrBlastRecord } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { projectBlast } from './project.js';
import { BlastRepository } from './repository.js';

export class BlastService {
  private repo: BlastRepository;

  constructor(private container: Container) {
    this.repo = new BlastRepository(container.db);
  }

  async getBlast(workspaceId: string, prId: string): Promise<PrBlastRecord> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');

    const files = await this.repo.getPrFiles(prId);
    const paths = files.map((f) => f.path);

    const intel = this.container.repoIntel;
    const indexState = await intel.getIndexState(pull.repoId);

    const priorPrs =
      paths.length === 0
        ? []
        : await this.repo.findPriorPrsOverlappingFiles(pull.repoId, prId, paths);

    // Empty PR files: avoid facade empty-input path (always tags degraded/no_data).
    // Status still reflects a broken index via projectBlast.
    if (paths.length === 0) {
      return projectBlast({
        blast: {
          changedSymbols: [],
          callers: [],
          impactedEndpoints: [],
          degraded: false,
        },
        indexState,
        priorPrs,
      });
    }

    const blast = await intel.getBlastRadius(pull.repoId, paths);
    const dependents = await intel.getDependentFiles(pull.repoId, paths);
    const dependentFactsByFile = await intel.getFileFacts(pull.repoId, dependents);

    return projectBlast({
      blast,
      indexState,
      dependentFactsByFile,
      priorPrs,
    });
  }
}
