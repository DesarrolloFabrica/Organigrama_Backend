/**
 * Prompt P1 prototipo v1.1.0 — explicitness estricta, tools agrupados, headings.
 * Diff vs 1.0.0: políticas de explicitness, granularidad, tools, rechazos, headings.
 * Sin cambio de evidenceKind / schema / offsets / prohibiciones taxonómicas.
 */
import { P1_PROMPT_VERSION } from './p1.types';
import type { EvidenceBatch, EvidenceCandidate } from './p1.types';

export { P1_PROMPT_VERSION };

export function buildP1PrototypeSystemPrompt(): string {
  return [
    'Rol: clasificador de evidencia profesional pre-taxonómica (MC1 P1).',
    'Propósito: decidir, para cada candidato textual de un CV, si contiene evidencia profesional y tipificarla.',
    '',
    'Definición: evidencia profesional = práctica coherente atribuible a la persona (acción, responsabilidad, proyecto, entregable, resultado, uso demostrado de herramienta, metodología, certificación, conocimiento, idioma o formación).',
    'Principio de granularidad: UNA unidad = UNA práctica coherente. No una evidencia por cada sustantivo técnico.',
    '',
    'evidenceKind (cerrado, sin cambios): ACTION | RESPONSIBILITY | PROJECT | DELIVERABLE | RESULT | TOOL_USAGE | METHODOLOGY | CERTIFICATION | KNOWLEDGE_STATEMENT | LANGUAGE | EDUCATION_SIGNAL | OTHER_PROFESSIONAL_EVIDENCE',
    '',
    '=== explicitness v1.1 (estricto) ===',
    'EXPLICIT: solo si el span muestra de forma directa acción profesional + objeto/práctica (verbo+objeto, acción+resultado, o uso demostrado+herramienta).',
    'STRONGLY_SUPPORTED: span nominal, viñeta incompleta, o requiere headingContext/adyacente para interpretarse; atribución fuerte sin verbo completo.',
    'INFERRED: interpretación adicional → la decisión del candidato DEBE ser REVIEW_REQUIRED.',
    'CRÍTICO: una lista de herramientas/tecnologías/materias NO puede ser EXPLICIT TOOL_USAGE solo por estar listada.',
    '',
    '=== herramientas y listados nominales ===',
    'Listado nominal sin acción (A, B, C bajo heading HERRAMIENTAS/HABILIDADES): preferir UNA evidencia KNOWLEDGE_STATEMENT agrupada que cubra el listado, o REJECTED_CONTEXT_ONLY / REVIEW_REQUIRED. NUNCA una TOOL_USAGE por cada ítem.',
    'TOOL_USAGE EXPLICIT solo con evidencia textual de uso/aplicación/implementación/configuración/desarrollo/administración/producción de resultado.',
    'No separar acción+objeto+resultado de la misma práctica en varias units.',
    'Dividir solo si hay prácticas profesionales independientes.',
    '',
    '=== headings / contexto ===',
    'candidateType=HEADING → normalmente REJECTED_CONTEXT_ONLY (no es evidencia).',
    'Usar headingContext y blockType para interpretar candidatos siguientes; el heading NO forma parte de la cita salvo que el span lo incluya.',
    'Antes de REJECTED_*: evaluar headingContext, si es certificación/proyecto/educación/idioma, o lista de conocimiento agrupable.',
    '',
    'Decisiones por candidato (exactamente una): ACCEPTED | REJECTED_NON_PROFESSIONAL | REJECTED_CONTEXT_ONLY | AMBIGUOUS | REVIEW_REQUIRED',
    '',
    'PROHIBIDO devolver: dominio, especialidad, skill, nivel, cargo como evidencia clasificatoria, área, coordinación, escuela, jefe, jerarquía, organigrama.',
    'PROHIBIDO: inventar candidateId; inventar texto fuente; reescribir la cita como autoridad; omitir candidatos; offsets fuera del candidato.',
    'Para ACCEPTED: evidenceItems con relativeStart/relativeEnd (0-based, half-open) DENTRO del texto del candidato.',
    'sourceText lo reconstruye el sistema; no uses texto libre como fuente.',
    '',
    'Debes emitir decisión para TODOS los candidateId listados. Ninguno omitido.',
    `promptVersion=${P1_PROMPT_VERSION}`,
  ].join('\n');
}

export function buildP1PrototypeUserPayload(params: {
  batch: EvidenceBatch;
  candidates: EvidenceCandidate[];
  contextCandidates: EvidenceCandidate[];
}): string {
  const evaluable = params.batch.candidateIds.map((id) => {
    const c = params.candidates.find((x) => x.candidateId === id)!;
    return {
      candidateId: c.candidateId,
      pageNumber: c.pageNumber,
      candidateType: c.candidateType,
      characterCount: c.characterCount,
      headingContext: c.headingContext,
      parentHeadingCandidateId: c.parentHeadingCandidateId ?? null,
      blockType: c.blockType ?? null,
      text: c.text,
    };
  });

  const context = params.contextCandidates.map((c) => ({
    candidateId: c.candidateId,
    role: 'CONTEXT_ONLY_NOT_EVALUABLE',
    candidateType: c.candidateType,
    blockType: c.blockType ?? null,
    text: c.text,
  }));

  return JSON.stringify(
    {
      instruction:
        'Clasifica solo evaluable[]. Aplica políticas v1.1 (explicitness, tools agrupados, headings). JSON: batchId + candidateResults[].',
      batchId: params.batch.batchId,
      schemaHint: {
        batchId: 'string',
        candidateResults: [
          {
            candidateId: 'string',
            decision: 'ACCEPTED|...',
            reasonCode: 'string?',
            evidenceItems: [
              {
                relativeStart: 0,
                relativeEnd: 1,
                evidenceKind: 'ACTION',
                explicitness: 'EXPLICIT|STRONGLY_SUPPORTED|INFERRED',
                normalizedActivity: 'string?',
                object: 'string?',
                toolOrMethod: 'string?',
                result: 'string?',
                scope: 'string?',
                temporalContext: 'string?',
                confidenceComponents: {
                  extractionCertainty: 0.0,
                  spanIntegrity: 1.0,
                  contextSupport: 0.0,
                  ambiguity: 0.0,
                },
              },
            ],
          },
        ],
        warnings: [],
      },
      context,
      evaluable,
    },
    null,
    2,
  );
}

/** Diff conceptual 1.0.0 → 1.1.0 (para docs). */
export const P1_PROMPT_DIFF_1_0_TO_1_1 = {
  from: 'MC1.P1.PROMPT.PROTOTYPE.1.0.0',
  to: 'MC1.P1.PROMPT.PROTOTYPE.1.1.0',
  changed: [
    'explicitness estricto (EXPLICIT requiere verbo/uso demostrado)',
    'listas nominales de tools → KNOWLEDGE agrupado / CONTEXT / REVIEW (no átomos TOOL)',
    'principio de granularidad: una práctica = una unit',
    'uso de headingContext/blockType antes de rechazar',
    'HEADING → REJECTED_CONTEXT_ONLY por defecto',
  ],
  unchanged: [
    'evidenceKind cerrado',
    'schema offsets relativos',
    'prohibiciones taxonómicas',
    'decisión obligatoria por candidato',
    'INFERRED → REVIEW_REQUIRED',
  ],
};
