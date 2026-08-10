import type { DataSource } from 'typeorm';
import { P1ArtifactWriter } from './p1-artifact-writer';
import { P1CanonicalEvidenceReader } from './p1-canonical-evidence.reader';
import { p1Error } from './p1-persistence.errors';
import { P1ReviewQueueGateway } from './p1-review-queue.gateway';
import { P1RunCursorService } from './p1-run-cursor.service';
import { P1RunLifecycleService } from './p1-run-lifecycle.service';
import { P1RunRepository } from './p1-run.repository';
import type {
  AdvanceCursorInput,
  FinalizeRunInput,
  MarkBatchFailedInput,
  PersistBatchInput,
  PlanRunOptions,
  P1PersistenceMode,
  P1RunConfig,
} from './p1-persistence.types';

type PersistDeps = {
  repo: P1RunRepository;
  lifecycle: P1RunLifecycleService;
  writer: P1ArtifactWriter;
  cursor: P1RunCursorService;
  reader: P1CanonicalEvidenceReader;
  reviewGateway: P1ReviewQueueGateway;
};

/**
 * Fachada del adapter de persistencia P1.
 * DRY_RUN / ARTIFACT_ONLY no instancian writers ni abren rutas de escritura.
 */
export class P1PersistenceService {
  readonly mode: P1PersistenceMode;
  private readonly deps: PersistDeps | null;

  private constructor(mode: P1PersistenceMode, deps: PersistDeps | null) {
    this.mode = mode;
    this.deps = deps;
  }

  static createNonPersistent(mode: 'DRY_RUN' | 'ARTIFACT_ONLY'): P1PersistenceService {
    return new P1PersistenceService(mode, null);
  }

  static createPersistMde(dataSource: DataSource): P1PersistenceService {
    const repo = new P1RunRepository(dataSource);
    const reviewGateway = new P1ReviewQueueGateway();
    const lifecycle = new P1RunLifecycleService(repo);
    const writer = new P1ArtifactWriter(repo, reviewGateway);
    const cursor = new P1RunCursorService(repo);
    const reader = new P1CanonicalEvidenceReader(dataSource);
    return new P1PersistenceService('PERSIST_MDE', {
      repo,
      lifecycle,
      writer,
      cursor,
      reader,
      reviewGateway,
    });
  }

  /** True si esta instancia tiene writer de BD (solo PERSIST_MDE). */
  get hasDbWriter(): boolean {
    return this.deps !== null;
  }

  planRun(
    snapshotId: string,
    config: P1RunConfig,
    fingerprint?: string | null,
    options?: PlanRunOptions,
  ) {
    return this.requirePersist().lifecycle.planRun(
      snapshotId,
      config,
      fingerprint,
      options,
    );
  }

  startRun(
    p1RunId: string,
    opts?: { campaignId?: string | null; pipelineRunId?: string | null },
  ) {
    return this.requirePersist().lifecycle.startRun(p1RunId, opts);
  }

  persistBatch(p1RunId: string, input: PersistBatchInput) {
    return this.requirePersist().writer.persistBatch(p1RunId, input);
  }

  markBatchFailed(input: MarkBatchFailedInput) {
    return this.requirePersist().writer.markBatchFailed(input);
  }

  finalizeRun(input: FinalizeRunInput) {
    return this.requirePersist().lifecycle.finalizeRun(input);
  }

  advanceCurrentCursor(input: AdvanceCursorInput) {
    return this.requirePersist().cursor.advanceCurrentCursor(input);
  }

  resumeRun(p1RunId: string) {
    return this.requirePersist().lifecycle.resumeRun(p1RunId);
  }

  getReusableRun(snapshotId: string, configFingerprint: string) {
    return this.requirePersist().lifecycle.getReusableRun(
      snapshotId,
      configFingerprint,
    );
  }

  getCanonicalEvidenceForP2(filters?: { snapshotId?: string }) {
    return this.requirePersist().reader.getCanonicalEvidenceForP2(filters);
  }

  failRun(p1RunId: string, errorCode: string) {
    return this.requirePersist().lifecycle.failRun(p1RunId, errorCode);
  }

  cancelRun(p1RunId: string, errorCode?: string) {
    return this.requirePersist().lifecycle.cancelRun(p1RunId, errorCode);
  }

  private requirePersist(): PersistDeps {
    if (this.mode !== 'PERSIST_MDE' || !this.deps) {
      throw p1Error(
        'MODE_FORBIDS_PERSISTENCE',
        `${this.mode} mode forbids P1 DB writers`,
        { mode: this.mode },
      );
    }
    return this.deps;
  }
}

export function createP1PersistenceService(opts: {
  mode: P1PersistenceMode;
  dataSource?: DataSource;
}): P1PersistenceService {
  if (opts.mode === 'DRY_RUN' || opts.mode === 'ARTIFACT_ONLY') {
    return P1PersistenceService.createNonPersistent(opts.mode);
  }
  if (!opts.dataSource) {
    throw p1Error(
      'MODE_FORBIDS_PERSISTENCE',
      'PERSIST_MDE requires DataSource',
    );
  }
  return P1PersistenceService.createPersistMde(opts.dataSource);
}
