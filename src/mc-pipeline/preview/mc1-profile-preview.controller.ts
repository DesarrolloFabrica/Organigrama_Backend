import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Optional,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Public } from '../../auth/public.decorator';
import { Mc1ProfilePreviewGuard } from './mc1-profile-preview.guard';
import {
  Mc1ProfilePreviewService,
  type PersonLookupRow,
} from './mc1-profile-preview.service';

@Public()
@UseGuards(Mc1ProfilePreviewGuard)
@Controller('dev/mc1-profile-preview')
export class Mc1ProfilePreviewController {
  private service: Mc1ProfilePreviewService | null = null;

  constructor(
    @Optional()
    @Inject(DataSource)
    private readonly dataSource?: DataSource,
  ) {}

  /** Lazy: avoid resolving tmp/backendRoot during Nest boot in production. */
  private getPreviewService(): Mc1ProfilePreviewService {
    if (!this.service) {
      this.service = new Mc1ProfilePreviewService();
    }
    return this.service;
  }

  @Get('cases')
  async listCases() {
    const lookups = await this.resolvePersonLookups();
    return {
      mode: 'ARTIFACT_ONLY',
      cases: this.getPreviewService().listCases(lookups),
    };
  }

  @Get()
  async getPreview(
    @Query('caseId') caseId?: string,
    @Query('snapshot') snapshot?: string,
    @Query('debug') debugRaw?: string,
  ) {
    const debug = debugRaw === '1' || debugRaw === 'true';
    const lookups = await this.resolvePersonLookups();

    let resolvedCaseId = caseId?.trim();
    if (!resolvedCaseId && snapshot?.trim()) {
      resolvedCaseId = `snap-${snapshot.trim()}`;
    }
    if (!resolvedCaseId) {
      throw new NotFoundException('caseId or snapshot required');
    }

    const presentation = this.getPreviewService().getCase({
      caseId: resolvedCaseId,
      debug,
      personLookups: lookups,
    });
    if (!presentation) {
      throw new NotFoundException(`unknown caseId: ${resolvedCaseId}`);
    }
    return presentation;
  }

  private async resolvePersonLookups(): Promise<Map<string, PersonLookupRow>> {
    const map = new Map<string, PersonLookupRow>();
    if (!this.dataSource?.isInitialized) return map;

    for (const { caseId, document } of this.getPreviewService().realPersonDocuments()) {
      try {
        const rows = await this.dataSource.query(
          `
          SELECT
            p.id AS person_id,
            p.full_name AS full_name,
            pc.id::text AS person_cv_id,
            (
              SELECT s.id::text
              FROM organigrama.mc_cv_snapshot s
              WHERE s.person_cv_id = pc.id
              ORDER BY s.created_at DESC NULLS LAST, s.id DESC
              LIMIT 1
            ) AS latest_snapshot_id
          FROM core.person p
          LEFT JOIN organigrama.person_cv pc
            ON pc.person_id = p.id AND pc.is_active = true
          WHERE p.document = $1
          LIMIT 1
          `,
          [document],
        );
        const row = rows?.[0];
        if (!row) continue;
        map.set(caseId, {
          personId: Number(row.person_id),
          fullName: String(row.full_name ?? ''),
          personCvId: row.person_cv_id ? String(row.person_cv_id) : null,
          latestSnapshotId: row.latest_snapshot_id
            ? String(row.latest_snapshot_id)
            : null,
        });
      } catch {
        // Lookup opcional; preview de artefactos sigue funcionando.
      }
    }
    return map;
  }
}
