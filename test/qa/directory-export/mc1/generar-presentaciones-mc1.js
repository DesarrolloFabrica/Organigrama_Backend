// Genera perfiles MC1 PUBLICADOS sintéticos (organigrama.mc1_person_profile_presentation)
// para el explorador de competencias de la base QA. Valida cada payload con el
// validador real del backend (dist) y escribe 05_presentaciones_mc1.sql.
//
// NO usar scripts/mc1-import-person-profile-presentation.ts para QA: ese script
// siempre lee el .env del repositorio (que en el worktree apunta a producción).
//
// Uso (desde la raíz del backend, con dist compilado):
//   node test/qa/directory-export/mc1/generar-presentaciones-mc1.js
const fs = require('fs');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..', '..', '..', '..');
const { validateMc1PresentationPayload } = require(
  path.join(backendRoot, 'dist', 'mc-pipeline', 'person-profile', 'mc1-person-profile-store.js'),
);

const skill = (code, name) => ({ code, name });
const field = (code, label, role, evidenceVolume, specialties, tools, dimensions) => ({
  code, label, role, specialties, tools, evidenceVolume,
  competencyMap: { dimensions },
});

// Personas que deben quedar SIN perfil publicado a propósito: con un perfil
// MC1 publicado, la pestaña Competencias muestra la vista de perfil profesional
// en lugar de la evaluación del motor con radar. La Directora (900100) conserva
// la evaluación curada (mc1/qa-mc1-*.json) para que QA cubra también el radar.
const SIN_PUBLICAR = [900100];

const PERFILES = [
  {
    personId: 900103, // Analista QA Uno
    fields: [
      field('SOFTWARE_ENGINEERING', 'Ingeniería de software', 'PRIMARY', 'HIGH', [
        { code: 'FRONTEND_ENGINEERING', label: 'Ingeniería frontend', confidence: 0.9, skills: [skill('react', 'React'), skill('typescript', 'TypeScript')] },
        { code: 'BACKEND_ENGINEERING', label: 'Ingeniería backend', confidence: 0.8, skills: [skill('nestjs', 'NestJS'), skill('postgresql', 'PostgreSQL')] },
      ], ['Git', 'Docker'], [
        { code: 'SWE_FRONTEND', label: 'Frontend', relativeCoverage: 100 },
        { code: 'SWE_BACKEND', label: 'Backend', relativeCoverage: 85 },
      ]),
    ],
  },
  {
    personId: 900104, // Analista QA Dos
    fields: [
      field('SOFTWARE_ENGINEERING', 'Ingeniería de software', 'PRIMARY', 'MEDIUM', [
        { code: 'BACKEND_ENGINEERING', label: 'Ingeniería backend', confidence: 0.8, skills: [skill('postgresql', 'PostgreSQL'), skill('rest_apis_qa', 'APIs REST QA')] },
        { code: 'PLATFORM_DEVOPS_ENGINEERING', label: 'Plataforma y DevOps', confidence: 0.7, skills: [skill('docker', 'Docker')] },
      ], ['Postman'], [
        { code: 'SWE_BACKEND', label: 'Backend', relativeCoverage: 100 },
        { code: 'SWE_DEVOPS', label: 'DevOps', relativeCoverage: 70 },
      ]),
      field('DATA_ANALYTICS', 'Analítica de datos', 'SECONDARY', 'LOW', [
        { code: 'DATA_ENGINEERING', label: 'Ingeniería de datos', confidence: 0.6, skills: [skill('sql_qa', 'SQL QA')] },
      ], [], [
        { code: 'DA_ENGINEERING', label: 'Datos', relativeCoverage: 55 },
      ]),
    ],
  },
  {
    personId: 900113, // Exportador Ambos QA
    fields: [
      field('PROJECT_PROGRAM_MGMT', 'Gestión de proyectos y programas', 'PRIMARY', 'HIGH', [
        { code: 'PROCESS_IMPROVEMENT', label: 'Mejora de procesos', confidence: 0.9, skills: [skill('mejora_procesos_qa', 'Mejora de procesos QA')] },
        { code: 'PROJECT_MANAGEMENT', label: 'Gestión de proyectos', confidence: 0.8, skills: [skill('coordinacion_operativa_qa', 'Coordinación operativa QA')] },
      ], ['Hojas de cálculo (QA)'], [
        { code: 'PPM_PROCESS', label: 'Procesos', relativeCoverage: 100 },
        { code: 'PPM_PROJECTS', label: 'Proyectos', relativeCoverage: 80 },
      ]),
      field('DATA_ANALYTICS', 'Analítica de datos', 'SECONDARY', 'MEDIUM', [
        { code: 'BUSINESS_INTELLIGENCE', label: 'Inteligencia de negocio', confidence: 0.7, skills: [skill('tableros_qa', 'Tableros de indicadores QA')] },
      ], [], [
        { code: 'DA_BI', label: 'Inteligencia de negocio', relativeCoverage: 70 },
      ]),
    ],
  },
];

const sqlEsc = (s) => s.replace(/'/g, "''");
const lines = [
  '-- QA — perfiles MC1 PUBLICADOS sintéticos para el explorador de competencias.',
  '-- Generado por mc1/generar-presentaciones-mc1.js (payloads validados con el',
  '-- validador real del backend). Idempotente. Solo base QA.',
  'BEGIN;',
  "DO $$ BEGIN IF current_setting('organigrama.environment', true) IS DISTINCT FROM 'qa' THEN",
  "  RAISE EXCEPTION 'Base no marcada como QA (ejecute 00_marcar_base_qa.sql).'; END IF; END $$;",
  '-- Sin perfil publicado a propósito (su pestaña Competencias usa el radar del motor).',
  `UPDATE organigrama.mc1_person_profile_presentation SET is_active = FALSE WHERE person_id IN (${SIN_PUBLICAR.join(', ')}) AND is_active = TRUE;`,
];
for (const p of PERFILES) {
  const payload = { status: 'AVAILABLE', source: 'QA_SINTETICO', fields: p.fields };
  const v = validateMc1PresentationPayload(payload);
  if (!v.ok) throw new Error(`payload inválido para ${p.personId}: ${v.reason}`);
  const json = sqlEsc(JSON.stringify(payload));
  lines.push(
    `UPDATE organigrama.mc1_person_profile_presentation SET is_active = FALSE WHERE person_id = ${p.personId} AND is_active = TRUE;`,
    `INSERT INTO organigrama.mc1_person_profile_presentation (person_id, payload_json, config_fingerprint, produced_at, is_active, imported_at) VALUES (${p.personId}, '${json}'::jsonb, 'qa-sintetico-v1', NOW(), TRUE, NOW());`,
  );
  console.log(`válido: persona ${p.personId} (${p.fields.map((f) => f.code).join(', ')})`);
}
lines.push('COMMIT;', '');
const out = path.resolve(__dirname, '..', '05_presentaciones_mc1.sql');
fs.writeFileSync(out, lines.join('\n'));
console.log(`escrito ${path.relative(backendRoot, out)}`);
