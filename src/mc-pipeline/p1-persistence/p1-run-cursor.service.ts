import { p1Error } from './p1-persistence.errors';
import type { P1RunRepository } from './p1-run.repository';
import type { AdvanceCursorInput } from './p1-persistence.types';

export class P1RunCursorService {
  constructor(private readonly repo: P1RunRepository) {}

  /**
   * TX separada del finalize. Idempotente si el cursor ya apunta al mismo run.
   * Permite reconciliar run satisfactorio sin cursor.
   */
  async advanceCurrentCursor(input: AdvanceCursorInput): Promise<{
    snapshotId: string;
    lineageKey: string;
    p1RunId: string;
    previousP1RunId: string | null;
    noop: boolean;
  }> {
    const run = await this.repo.findRunById(input.p1RunId);
    if (!run) {
      throw p1Error('RUN_NOT_FOUND', 'run not found', {
        p1RunId: input.p1RunId,
      });
    }
    if (String(run.snapshot_id) !== String(input.snapshotId)) {
      throw p1Error(
        'CURSOR_TARGET_NOT_ELIGIBLE',
        'run snapshot does not match cursor snapshot',
      );
    }
    if (
      run.status !== 'COMPLETED' &&
      run.status !== 'COMPLETED_WITH_WARNINGS'
    ) {
      throw p1Error(
        'CURSOR_TARGET_NOT_ELIGIBLE',
        'cursor requires satisfactory run',
        { status: run.status },
      );
    }

    const current = await this.repo.getCursor(
      input.snapshotId,
      input.lineageKey,
    );
    if (current && current.p1_run_id === input.p1RunId) {
      return {
        snapshotId: input.snapshotId,
        lineageKey: input.lineageKey,
        p1RunId: input.p1RunId,
        previousP1RunId: current.previous_p1_run_id,
        noop: true,
      };
    }

    try {
      await this.repo.upsertCursor({
        snapshotId: input.snapshotId,
        lineageKey: input.lineageKey,
        p1RunId: input.p1RunId,
        previousP1RunId: current?.p1_run_id ?? null,
        promotedReason: input.promotedReason,
      });
      const after = await this.repo.getCursor(
        input.snapshotId,
        input.lineageKey,
      );
      return {
        snapshotId: input.snapshotId,
        lineageKey: input.lineageKey,
        p1RunId: input.p1RunId,
        previousP1RunId: after?.previous_p1_run_id ?? null,
        noop: false,
      };
    } catch (e) {
      this.repo.mapDbError(e);
    }
  }
}
