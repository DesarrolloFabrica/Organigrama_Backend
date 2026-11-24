/**
 * Asociación ÁREA del HTML → icono oficial de coordinación.
 *
 * El HTML exportado agrupa por `core.area` de cada persona (ver
 * org-chart-directory-presentation.ts); por eso la clave de búsqueda es el
 * nombre del área, normalizado (sin tildes, mayúsculas, espacios simples).
 * Solo hay coincidencia EXACTA: un área que no está en la tabla conserva el
 * fondo neutro existente (no se deduce ningún icono por parecido).
 *
 * Evidencia de cada correspondencia (verificada el 24-nov-2026, solo lectura):
 * - El frontend robusto (16b490d) asigna los emblemas en
 *   src/features/org-chart/config/coordinationEmblems.ts a la persona que
 *   encabeza cada coordinación.
 * - En producción (versión 4), esa persona es la raíz de la sección de área
 *   del HTML y pertenece a esa área en core.area:
 *
 *   Área (core.area)                  Responsable (id · cargo)                         Archivo oficial
 *   DIRECCION GENERAL DE OPERACIONES  1144 · DIRECTOR DE OPERACIONES                    DirectorOp.png (*)
 *   B2B                               1191 · SUPERVISOR B2B                             B2B.png
 *   ESPECIALIZACIONES                 1081 · COORDINADOR DE ESPECIALIZACIONES           Especializaciones.png
 *   FABRICA Y DESARROLLO              49   · COORDINADOR DE FABRICA CONTENIDO Y DES.    Fabrica.png
 *   HOMOLOGACIONES                    1145 · LIDER DE SERVICIO                          Servicio.png (**)
 *   OPERACION ACADEMICA               1077 · COORDINADOR DE OPERACIÓN ACADEMICA         Operación Académica.png
 *   PRACTICAS                         1352 · COORDINADOR DESARROLLO PROFESIONAL         Desarrollo profesional.png
 *   PROYECCION SOCIAL                 1193 · COORDINADOR PROYECCIÓN SOCIAL              proyección social.png
 *   SABER PRO                         1192 · COORDINADOR PRUEBAS SABER                  Saber Pro .png
 *
 *   (*)  En el mapa es el emblema del Director de Operaciones, que encabeza el
 *        área de Dirección. Existe también CoordinacionGeneral.png (Coordinador
 *        General, misma área); se usa el del responsable del área. Aprobado
 *        por el usuario (24-nov-2026).
 *   (**) Mismo emblema que el mapa muestra sobre el responsable del área (Líder
 *        de Servicio). La carpeta oficial contiene además Homologaciones.png,
 *        sin uso en el mapa; el usuario eligió Servicio.png (24-nov-2026).
 *
 * El área PRACTICAS no tiene archivo con ese nombre: su coordinación es
 * «Desarrollo Profesional» en el mapa, y ese es su emblema.
 */

/** Identificador estable de cada icono incrustado. */
export type CoordinationEmblemKey =
  | 'direccion'
  | 'b2b'
  | 'especializaciones'
  | 'fabrica'
  | 'homologaciones'
  | 'operacionAcademica'
  | 'practicas'
  | 'proyeccionSocial'
  | 'saberPro';

/** Nombre de área normalizado → icono. Única fuente de la asociación. */
export const AREA_COORDINATION_EMBLEMS: Readonly<
  Record<string, CoordinationEmblemKey>
> = {
  'DIRECCION GENERAL DE OPERACIONES': 'direccion',
  B2B: 'b2b',
  ESPECIALIZACIONES: 'especializaciones',
  'FABRICA Y DESARROLLO': 'fabrica',
  HOMOLOGACIONES: 'homologaciones',
  'OPERACION ACADEMICA': 'operacionAcademica',
  PRACTICAS: 'practicas',
  'PROYECCION SOCIAL': 'proyeccionSocial',
  'SABER PRO': 'saberPro',
};

/**
 * Color oficial de cada coordinación (rediseño HTML, etapa 2), tomado de su
 * propio icono, no elegido a mano.
 *
 * Medición (24-nov-2026, Chromium sobre el PNG oficial a 300 px, píxeles con
 * alfa ≥ 220 y saturados): los iconos son prácticamente monocromáticos, con un
 * degradado de luminosidad en algunos.
 * - `principal`: color mediano (percentil 50 de luminosidad) del icono.
 * - `secundario`: extremo claro del degradado (percentil 90), solo cuando su
 *   TONO difiere de forma apreciable del principal (≥ 8°); si no, null y se
 *   usa el principal.
 * - `mapa`: color de halo (`glowColor`) que el mapa del frontend ya asocia a
 *   ese emblema; solo como referencia de coherencia, no se usa.
 *
 * Estos colores oficiales suelen ser oscuros para el fondo del documento; las
 * variantes legibles se DERIVAN de ellos en coordination-palette.ts (mismo
 * tono y saturación, más luz solo si hace falta contraste).
 */
export type CoordinationColor = {
  principal: string;
  secundario: string | null;
  mapa: string;
  /** Descripción del icono y del color, para la documentación. */
  nota: string;
};

export const COORDINATION_COLORS: Readonly<
  Record<CoordinationEmblemKey, CoordinationColor>
> = {
  direccion: {
    principal: '#003a1e',
    secundario: null,
    mapa: '#10b981',
    nota: 'DirectorOp.png: dragón en verde bosque plano (un solo color)',
  },
  b2b: {
    principal: '#aa0919',
    secundario: null,
    mapa: '#ef4444',
    nota: 'B2B.png: ave en rojo carmesí plano (un solo color)',
  },
  especializaciones: {
    principal: '#950300',
    secundario: null,
    mapa: '#ff4c4c',
    nota: 'Especializaciones.png: águila en rojo escarlata con degradado de luz (mismo tono)',
  },
  fabrica: {
    principal: '#62c4b7',
    secundario: null,
    mapa: '#52beb5',
    nota: 'Fabrica.png: foca en verde azulado con degradado de luz (Δ tono 6,6°)',
  },
  homologaciones: {
    principal: '#ca1a70',
    secundario: null,
    mapa: '#f43f94',
    nota: 'Servicio.png: flamenco en magenta con degradado de luz (mismo tono)',
  },
  operacionAcademica: {
    principal: '#353972',
    secundario: null,
    mapa: '#60d2ff',
    nota: 'Operación Académica.png: lobo en azul índigo (Δ tono 3°); el mapa usa un celeste distinto al icono',
  },
  practicas: {
    principal: '#b25397',
    secundario: '#cf549a',
    mapa: '#f472b6',
    nota: 'Desarrollo profesional.png: mariposa en orquídea con degradado hacia rosa (Δ tono 8,8°)',
  },
  proyeccionSocial: {
    principal: '#237f31',
    secundario: '#399232',
    mapa: '#4ade80',
    nota: 'proyección social.png: colibrí en verde con degradado hacia verde hoja (Δ tono 13,5°)',
  },
  saberPro: {
    principal: '#88b624',
    secundario: null,
    mapa: '#bef23c',
    nota: 'Saber Pro .png: suricata en verde lima con degradado de luz (mismo tono)',
  },
};

/** Normaliza un nombre de área para la búsqueda exacta. */
export function normalizeAreaName(areaName: string): string {
  return areaName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

/** Icono oficial del área, o null si no tiene uno identificado (fondo neutro). */
export function resolveAreaEmblemKey(
  areaName: string,
): CoordinationEmblemKey | null {
  const key = normalizeAreaName(areaName);
  // Solo claves propias de la tabla (nunca propiedades heredadas del prototipo).
  return Object.prototype.hasOwnProperty.call(AREA_COORDINATION_EMBLEMS, key)
    ? AREA_COORDINATION_EMBLEMS[key]
    : null;
}
