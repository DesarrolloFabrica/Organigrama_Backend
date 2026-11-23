// Genera perfiles MC1 curados 100 % SINTÉTICOS para la base QA.
// Mismo formato que src/database/scripts/fixtures (mc1-curated-profile-1.1.0),
// pero sin ningún dato real: personas ficticias (documentos 9000000xxx),
// skills y evidencias inventadas y marcadas como QA.
// Uso: node generar-perfiles-mc1.js   (escribe los JSON junto a este archivo)
const fs = require('fs');
const path = require('path');

const skill = (name, type, confidence, evidence) => ({
  canonicalName: name,
  skillType: type,
  confidence,
  reviewDecision: 'APPROVED_FOR_CREATION',
  evidence: evidence.map((text) => ({
    text: `Evidencia sintética QA: ${text}`,
    evidenceType: 'EXPLICIT',
    sourceSection: 'WORK_EXPERIENCE',
  })),
});

const profile = ({ file, document, domain, domainName, summary, specialties }) => ({
  file,
  doc: {
    schemaVersion: 'mc1-curated-profile-1.1.0',
    source: {
      type: 'MANUAL_CURATED',
      method: 'CHATGPT_HUMAN_REVIEW',
      reviewStatus: 'REVIEWED',
      reviewedAt: '2026-11-23T00:00:00.000Z',
      notes: 'Perfil SINTÉTICO para QA local. No corresponde a ninguna persona real.',
    },
    person: { document },
    profile: { primaryDomainCode: domain, summary },
    domain: { code: domain, name: domainName, confidence: 0.9 },
    specialties,
  },
});

const PROFILES = [
  profile({
    file: 'qa-mc1-directora-gestion-educativa.json',
    document: '9000000100',
    domain: 'EDUCATION_MANAGEMENT',
    domainName: 'Gestión Educativa',
    summary: 'Perfil sintético QA: dirección de programas académicos y calidad.',
    specialties: [
      { code: 'EM_ACADEMIC_PROGRAMS', name: 'Gestión de Programas Académicos', confidence: 0.9, skills: [
        skill('Planeación académica QA', 'PROFESSIONAL_KNOWLEDGE', 0.9, ['coordinó la planeación semestral de un programa ficticio.']),
        skill('Gestión de oferta académica QA', 'PROFESSIONAL_KNOWLEDGE', 0.85, ['organizó la oferta de cursos de un programa ficticio.']),
      ] },
      { code: 'EM_ACADEMIC_QUALITY', name: 'Calidad Académica', confidence: 0.8, skills: [
        skill('Registro calificado QA', 'PROFESSIONAL_KNOWLEDGE', 0.8, ['preparó documentación de calidad para un programa ficticio.']),
        skill('Autoevaluación institucional QA', 'METHODOLOGY', 0.75, ['condujo un ejercicio ficticio de autoevaluación.']),
      ] },
      { code: 'EM_ACADEMIC_LEADERSHIP', name: 'Liderazgo Académico', confidence: 0.85, skills: [
        skill('Liderazgo de equipos docentes QA', 'PROFESSIONAL_KNOWLEDGE', 0.85, ['lideró un equipo docente ficticio de diez personas.']),
      ] },
    ],
  }),
  profile({
    file: 'qa-mc1-analista-software.json',
    document: '9000000103',
    domain: 'SOFTWARE',
    domainName: 'Desarrollo de Software',
    summary: 'Perfil sintético QA: desarrollo web y bases de datos.',
    specialties: [
      { code: 'SOFTWARE_FRONTEND', name: 'Desarrollo frontend', confidence: 0.9, skills: [
        skill('React', 'TECHNOLOGY', 0.9, ['construyó interfaces de un proyecto ficticio con React.']),
        skill('TypeScript', 'TECHNOLOGY', 0.85, ['tipó componentes de un proyecto ficticio con TypeScript.']),
      ] },
      { code: 'SOFTWARE_BACKEND', name: 'Desarrollo backend', confidence: 0.8, skills: [
        skill('NestJS', 'TECHNOLOGY', 0.8, ['implementó servicios de un proyecto ficticio con NestJS.']),
      ] },
      { code: 'SOFTWARE_DATA', name: 'Bases de datos', confidence: 0.75, skills: [
        skill('PostgreSQL', 'TECHNOLOGY', 0.8, ['modeló tablas de un proyecto ficticio en PostgreSQL.']),
      ] },
    ],
  }),
  profile({
    file: 'qa-mc1-exportador-operaciones.json',
    document: '9000000113',
    domain: 'OPERATIONS_MANAGEMENT',
    domainName: 'Gestión de Operaciones',
    summary: 'Perfil sintético QA: coordinación operativa y analítica.',
    specialties: [
      { code: 'OPS_COORDINATION', name: 'Liderazgo Operativo', confidence: 0.9, skills: [
        skill('Coordinación de equipos operativos QA', 'PROFESSIONAL_KNOWLEDGE', 0.9, ['coordinó un equipo operativo ficticio.']),
      ] },
      { code: 'OPS_ANALYTICS', name: 'Analítica Operativa', confidence: 0.8, skills: [
        skill('Tableros de indicadores QA', 'TOOL', 0.8, ['construyó tableros ficticios de seguimiento.']),
        skill('Análisis de datos operativos QA', 'PROFESSIONAL_KNOWLEDGE', 0.75, ['analizó métricas ficticias de procesos.']),
      ] },
      { code: 'OPS_PROCESS', name: 'Procesos e Innovación', confidence: 0.7, skills: [
        skill('Mejora de procesos QA', 'METHODOLOGY', 0.7, ['rediseñó un proceso ficticio de atención.']),
      ] },
    ],
  }),
];

for (const { file, doc } of PROFILES) {
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(doc, null, 2) + '\n');
  console.log('generado', file);
}
