/**
 * Fixture de ejemplo para el contrato de curaduría manual.
 * Sin documento real versionado: usar PLACEHOLDER_DOCUMENT + --document= en CLI.
 */

import { CURATED_PROFILE_SCHEMA_VERSION } from './curated-profile.constants';
import type { CuratedProfileDocument } from './curated-profile.schema';

export const CURATED_PROFILE_DOCUMENT_PLACEHOLDER = 'PLACEHOLDER_DOCUMENT';

/**
 * Perfil SOFTWARE de ejemplo (schema 1.1.0):
 * - dominio EXISTING
 * - especialidad EXISTING
 * - skill existente (Java) REUSE_EXISTING
 * - alias (js) REUSE_EXISTING
 * - skill propuesta APPROVED_FOR_CREATION
 * - skill propuesta OMIT
 */
export function buildSoftwareCuratedProfileFixture(
  document: string = CURATED_PROFILE_DOCUMENT_PLACEHOLDER,
): CuratedProfileDocument {
  return {
    schemaVersion: CURATED_PROFILE_SCHEMA_VERSION,
    source: {
      type: 'MANUAL_CURATED',
      method: 'CHATGPT_HUMAN_REVIEW',
      reviewStatus: 'REVIEWED',
      reviewedAt: '2026-07-29T00:00:00.000Z',
      notes: 'Fixture piloto Fase 2 — sin datos sensibles.',
    },
    person: { document },
    profile: {
      primaryDomainCode: 'SOFTWARE',
      summary: 'Perfil piloto de curaduría manual para import controlado.',
    },
    domain: {
      code: 'SOFTWARE',
      name: 'Desarrollo de Software',
      confidence: 0.94,
    },
    specialties: [
      {
        code: 'SOFTWARE_BACKEND',
        name: 'Desarrollo backend',
        confidence: 0.95,
        skills: [
          {
            canonicalName: 'Java',
            displayName: 'Java',
            skillType: 'TECHNOLOGY',
            confidence: 0.98,
            reviewDecision: 'REUSE_EXISTING',
            evidence: [
              {
                text: 'Desarrollo de aplicaciones empresariales en Java con Spring.',
                evidenceType: 'EXPLICIT',
                sourceSection: 'WORK_EXPERIENCE',
              },
            ],
          },
          {
            canonicalName: 'js',
            displayName: 'JS',
            skillType: 'TECHNOLOGY',
            confidence: 0.9,
            reviewDecision: 'REUSE_EXISTING',
            evidence: [
              {
                text: 'Implementación de servicios Node con JavaScript en APIs REST.',
                evidenceType: 'EXPLICIT',
                sourceSection: 'PROJECT',
              },
            ],
          },
          {
            canonicalName: 'Mc1PilotHypotheticalFramework',
            displayName: 'Mc1 Pilot Hypothetical Framework',
            skillType: 'TECHNOLOGY',
            confidence: 0.7,
            reviewDecision: 'APPROVED_FOR_CREATION',
            evidence: [
              {
                text: 'Uso documentado de Mc1PilotHypotheticalFramework en un prototipo interno.',
                evidenceType: 'CONTEXTUAL',
                sourceSection: 'PROJECT',
              },
            ],
          },
          {
            canonicalName: 'Mc1PilotOmitSkill',
            displayName: 'Mc1 Pilot Omit Skill',
            skillType: 'TECHNOLOGY',
            confidence: 0.5,
            reviewDecision: 'OMIT',
            evidence: [
              {
                text: 'Mención experimental de Mc1PilotOmitSkill sin suficiente evidencia.',
                evidenceType: 'CONTEXTUAL',
                sourceSection: 'OTHER',
              },
            ],
          },
        ],
      },
    ],
    warnings: [],
    notes: [
      'Usar --document= para cédula real; no versionar cédulas en el repo.',
    ],
  };
}
