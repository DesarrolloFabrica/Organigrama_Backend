#!/usr/bin/env node
/*
 * Vista previa SINTÉTICA del exportador HTML del organigrama.
 *
 * - Sin base de datos, sin auditoría, sin permisos y sin red: llama directamente a la
 *   función pura `buildOrgChartHtml` del código COMPILADO (dist/).
 * - Usa 200 personas ficticias («Persona Sintética 001», documentos 9xxxxxxxx) con las
 *   mismas áreas y tamaños aproximados que producción, más un área sin icono oficial
 *   para comprobar el fondo neutro. No contiene ningún dato real.
 * - Con el commit 6736e60 genera, byte a byte, la vista previa aprobada en la Etapa 2.1
 *   del rediseño (ver docs/rediseno-html/README.md).
 *
 * Uso (desde la raíz del backend):
 *   npm run build
 *   node scripts/vista-previa-html-sintetica.cjs <salida.html>
 *
 * Guarde la salida FUERA del repositorio (o en una carpeta ignorada): es un artefacto de
 * revisión, no código fuente. Este script no viaja a la imagen de Cloud Run (.gcloudignore
 * excluye /scripts).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const outPath = process.argv[2];
if (!outPath) {
  console.error('Uso: node scripts/vista-previa-html-sintetica.cjs <salida.html>');
  process.exit(1);
}

const modulePath = path.join(__dirname, '..', 'dist', 'org-chart', 'org-chart-directory-presentation.js');
if (!fs.existsSync(modulePath)) {
  console.error(`No existe ${modulePath}. Ejecute primero: npm run build`);
  process.exit(1);
}
const { buildOrgChartHtml } = require(modulePath);

/** Personas ficticias con la forma de `PresentationPerson`. */
const people = [];
let n = 1;
const mk = (bossIds, roleName, areaName) => {
  const person = {
    personId: String(n),
    bossIds,
    inactiveBossNames: [],
    fullName: `Persona Sintética ${String(n).padStart(3, '0')}`,
    document: `9${String(n).padStart(8, '0')}`,
    roleName,
    areaName,
    photoUrl: '',
  };
  n += 1;
  people.push(person);
  return person;
};

const DIR = 'DIRECCION GENERAL DE OPERACIONES';
const director = mk([], 'DIRECTOR DE OPERACIONES', DIR);
const cg = mk([director.personId], 'COORDINADOR GENERAL DE OPERACIONES', DIR);
for (let i = 0; i < 4; i++) mk([cg.personId], 'ANALISTA OPERATIVO', DIR);

// [área, tamaño, líderes de equipo]; profundidad ≤ 3 bajo el coordinador.
const coords = [
  ['OPERACION ACADEMICA', 62, 5],
  ['FABRICA Y DESARROLLO', 41, 4],
  ['PRACTICAS', 31, 0],
  ['HOMOLOGACIONES', 14, 0],
  ['ESPECIALIZACIONES', 13, 0],
  ['PROYECCION SOCIAL', 13, 0],
  ['SABER PRO', 11, 0],
  ['B2B', 5, 0],
  // Área sin icono oficial: debe conservar el fondo neutro.
  ['AREA SINTETICA SIN ICONO', 4, 0],
];
for (const [area, size, leaders] of coords) {
  const head = mk([cg.personId], `COORDINADOR DE ${area}`, area);
  let left = size - 1;
  const leaderPs = [];
  for (let l = 0; l < leaders; l++) {
    leaderPs.push(mk([head.personId], `LIDER DE EQUIPO ${l + 1}`, area));
    left--;
  }
  for (let k = 0; left > 0; k++, left--) {
    const boss = leaderPs.length ? leaderPs[k % leaderPs.length] : head;
    mk([boss.personId], k % 5 === 0 ? 'PROFESIONAL' : 'AUXILIAR ADMINISTRATIVO', area);
  }
}

const html = buildOrgChartHtml(people, 'Versión sintética · demo (activa)', {});
fs.writeFileSync(outPath, html, 'utf8');
console.log(JSON.stringify({ personas: people.length, bytes: Buffer.byteLength(html), salida: path.resolve(outPath) }));
