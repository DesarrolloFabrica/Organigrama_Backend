import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CvSkillsEnrichmentOrchestratorService } from './cv-skills-enrichment-orchestrator.service';
import { CvSkillsEnrichmentService } from './cv-skills-enrichment.service';
import { MISSING_SKILL_FILLED_EMPTY } from './cv-skills-enrichment.constants';
import type { EnrichmentInputSkill } from './cv-skills-enrichment.types';

function skills(n: number): EnrichmentInputSkill[] {
  return Array.from({ length: n }, (_, i) => ({
    extractionSkillId: `id-${i}`,
    normalizedName: `Skill${i}`,
    sortOrder: i,
  }));
}

describe('CvSkillsEnrichmentOrchestratorService retries', () => {
  let orchestrator: CvSkillsEnrichmentOrchestratorService;
  let enrichBlock: jest.Mock;

  beforeEach(async () => {
    jest.useFakeTimers();
    enrichBlock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CvSkillsEnrichmentOrchestratorService,
        {
          provide: CvSkillsEnrichmentService,
          useValue: {
            resolveModel: () => 'gemini-test',
            enrichBlock,
          },
        },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    orchestrator = moduleRef.get(CvSkillsEnrichmentOrchestratorService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function runWithTimers(
    promise: Promise<unknown>,
  ): Promise<unknown> {
    const resultPromise = promise;
    await jest.runAllTimersAsync();
    return resultPromise;
  }

  it('éxito en segundo intento del bloque', async () => {
    const inputSkills = skills(2);
    enrichBlock
      .mockResolvedValueOnce({
        raw: { skills: [], warnings: [] },
        model: 'gemini-test',
        rawText: '{}',
      })
      .mockResolvedValueOnce({
        raw: {
          skills: inputSkills.map((s) => ({
            extractionSkillId: s.extractionSkillId,
            normalizedName: s.normalizedName,
            evidenceItems: [],
          })),
          warnings: [],
        },
        model: 'gemini-test',
        rawText: '{}',
      });

    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: { blockSize: 15, maxBlockAttempts: 3 },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('SUCCEEDED');
    expect(artifact.metrics.blockRetries).toBe(1);
    expect(artifact.metrics.missingFilledEmpty).toBe(0);
  });

  it('PARTIAL por fill tras fallos', async () => {
    enrichBlock.mockRejectedValue(new Error('boom'));
    const inputSkills = skills(2);
    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: {
          blockSize: 15,
          maxBlockAttempts: 1,
          maxMicroRetryAttempts: 1,
          microRetrySize: 5,
        },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('PARTIAL');
    expect(artifact.metrics.missingFilledEmpty).toBe(2);
    expect(artifact.validatedResult.skills).toHaveLength(2);
    expect(
      artifact.warnings.some((w) => w.includes(MISSING_SKILL_FILLED_EMPTY)),
    ).toBe(true);
  });

  it('FAILED inventario vacío', async () => {
    const artifact = await orchestrator.runDry({
      pdfBuffer: Buffer.from('%PDF'),
      input: {
        document: '1',
        pdfSha256: 'abc',
        inventorySource: { type: 'ARTIFACT', reference: 'x' },
        skills: [],
      },
    });
    expect(artifact.meta.status).toBe('FAILED');
    expect(enrichBlock).not.toHaveBeenCalled();
  });

  it('micro-retry exitoso tras 3 fallos de bloque → SUCCEEDED', async () => {
    const inputSkills = skills(2);
    const okRaw = {
      skills: inputSkills.map((s) => ({
        extractionSkillId: s.extractionSkillId,
        normalizedName: s.normalizedName,
        evidenceItems: [],
      })),
      warnings: [],
    };
    // 3 fallos de bloque + 1 micro ok
    enrichBlock
      .mockResolvedValueOnce({ raw: { skills: [], warnings: [] }, model: 't', rawText: '{}' })
      .mockResolvedValueOnce({ raw: { skills: [], warnings: [] }, model: 't', rawText: '{}' })
      .mockResolvedValueOnce({ raw: { skills: [], warnings: [] }, model: 't', rawText: '{}' })
      .mockResolvedValueOnce({ raw: okRaw, model: 't', rawText: '{}' });

    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: {
          blockSize: 15,
          maxBlockAttempts: 3,
          maxMicroRetryAttempts: 2,
          microRetrySize: 5,
        },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('SUCCEEDED');
    expect(artifact.metrics.microRetryCalls).toBeGreaterThanOrEqual(1);
    expect(artifact.metrics.missingFilledEmpty).toBe(0);
  });

  it('ID cambiado no se acepta; termina en fill/PARTIAL', async () => {
    const inputSkills = skills(1);
    enrichBlock.mockResolvedValue({
      raw: {
        skills: [
          {
            extractionSkillId: 'WRONG',
            normalizedName: 'Skill0',
            evidenceItems: [],
          },
        ],
        warnings: [],
      },
      model: 't',
      rawText: '{}',
    });

    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: {
          blockSize: 15,
          maxBlockAttempts: 1,
          maxMicroRetryAttempts: 1,
        },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('PARTIAL');
    expect(artifact.metrics.missingFilledEmpty).toBe(1);
    expect(artifact.validatedResult.skills[0].extractionSkillId).toBe('id-0');
  });

  it('skill desconocida adicional se ignora si solicitadas completas', async () => {
    const inputSkills = skills(1);
    enrichBlock.mockResolvedValue({
      raw: {
        skills: [
          {
            extractionSkillId: 'id-0',
            normalizedName: 'Skill0',
            evidenceItems: [],
          },
          {
            extractionSkillId: 'extra',
            normalizedName: 'Extra',
            evidenceItems: [],
          },
        ],
        warnings: [],
      },
      model: 't',
      rawText: '{}',
    });

    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: { blockSize: 15, maxBlockAttempts: 1 },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('SUCCEEDED');
    expect(artifact.metrics.unknownSkillsReturned).toBe(1);
    expect(artifact.validatedResult.skills).toHaveLength(1);
  });

  it('JSON/transient fallido luego éxito → SUCCEEDED', async () => {
    const inputSkills = skills(1);
    enrichBlock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        raw: {
          skills: [
            {
              extractionSkillId: 'id-0',
              normalizedName: 'Skill0',
              evidenceItems: [],
            },
          ],
          warnings: [],
        },
        model: 't',
        rawText: '{}',
      });

    const artifact = (await runWithTimers(
      orchestrator.runDry({
        pdfBuffer: Buffer.from('%PDF'),
        input: {
          document: '1',
          pdfSha256: 'abc',
          inventorySource: { type: 'ARTIFACT', reference: 'x' },
          skills: inputSkills,
        },
        blockConfig: { blockSize: 15, maxBlockAttempts: 3 },
      }),
    )) as Awaited<ReturnType<typeof orchestrator.runDry>>;

    expect(artifact.meta.status).toBe('SUCCEEDED');
    expect(artifact.metrics.blockRetries).toBe(1);
  });
});
