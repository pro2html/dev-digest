/**
 * Smart Diff service — compute-on-read from pr_files + latest review findings.
 * No LLM / model resolution. No Intent module imports.
 */
import type { SmartDiff } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError } from '../../platform/errors.js';
import { buildFindingLinesByPath, buildSmartDiff } from './build.js';
import { SmartDiffRepository } from './repository.js';

export class SmartDiffService {
  private repo: SmartDiffRepository;

  constructor(container: Container) {
    this.repo = new SmartDiffRepository(container.db);
  }

  async getSmartDiff(workspaceId: string, prId: string): Promise<SmartDiff> {
    const pull = await this.repo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');

    const [files, findingRows] = await Promise.all([
      this.repo.getPrFiles(prId),
      this.repo.getLatestReviewFindingLines(prId),
    ]);

    const findingLines = buildFindingLinesByPath(findingRows);
    return buildSmartDiff(
      files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
      })),
      findingLines,
    );
  }
}
