/**
 * Hoja de estilos base del HTML exportado (rediseño, etapa 2).
 *
 * Antes vivía dentro de buildOrgChartHtml; se separó aquí para que la
 * presentación visual se pueda iterar sin tocar la generación del documento.
 * Solo afecta a la apariencia: las clases y la estructura del marcado son las
 * mismas de siempre.
 *
 * Color: todas las reglas usan variables. Fuera de una coordinación valen el
 * cian y el ámbar institucionales de siempre (:root); dentro de una sección o
 * nodo con `data-emblem` / `data-coord` las redefine coordination-palette.ts.
 *   --c-rgb   acento de la coordinación (bordes, líneas, radar)
 *   --c-text  color legible para contadores, etiquetas e insignias
 *   --c2-rgb  color secundario (halo y degradados)
 *   --lead-*  responsables (ámbar fuera de coordinación; el color de la
 *             coordinación dentro de ella, con más intensidad y grosor)
 * El color va en bordes, líneas y textos cortos; las superficies siguen
 * oscuras y neutras, y los nombres y cargos en blanco/gris claro.
 *
 * Escala tipográfica (antes 9–12 px en tarjetas):
 *   título de coordinación 22–26 px · nombre 15–16 px (14 px en tarjeta mini)
 *   cargo 13 px · información secundaria 12–13 px · contadores/etiquetas 12–14 px
 *
 * Espaciado: tarjetas con más padding (14–16 px) y fotos mayores
 * (48 / 56 / 64 px); 12–14 px entre tarjetas; 20–28 px entre bloques;
 * secciones con 28–32 px de padding y 40 px de separación. Sin alturas fijas:
 * los nombres y cargos largos crecen en altura en vez de cortarse.
 *
 * Etapa 2.1: el menú lateral pasó a navigation.styles.ts (neutro en reposo,
 * color de coordinación solo al iluminarse) y la vista jerárquica (.hero)
 * recibió un fondo de «centro de mando» más profundo; el resto no cambia.
 *
 * Responsivo:
 *   ≤ 1100 px  menú más estrecho y cuadrícula de tarjetas algo menor;
 *   ≤ 900 px   una columna (menú arriba, sin posición fija), como antes;
 *   ≤ 600 px   paddings menores, tarjetas a todo el ancho, fotos 44–52 px.
 * El contenido principal se limita a 1480 px para que las líneas no se
 * alarguen en pantallas muy anchas.
 */
export const DOCUMENT_CSS = `
    :root {
      color-scheme: dark;
      --bg: #020617;
      --text: #e2e8f0;
      --text-2: #cbd5e1;
      --muted: #94a3b8;
      --surface: rgba(2,6,23,.55);
      --c-rgb: 34 211 238;
      --c-text: #67e8f9;
      --c2-rgb: 34 211 238;
      --lead-rgb: 245 158 11;
      --lead-text: #fbbf24;
    }
    /*
     * Un nodo de la vista jerárquica SIN coordinación propia no debe heredar el
     * color de su jefe (las variables CSS se heredan): vuelve al neutro.
     */
    .org-node:not([data-coord]) {
      --c-rgb: 34 211 238;
      --c-text: #67e8f9;
      --c2-rgb: 34 211 238;
      --lead-rgb: 245 158 11;
      --lead-text: #fbbf24;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(8,47,73,.9), transparent 42%),
        radial-gradient(circle at 80% 10%, rgba(14,116,144,.35), transparent 35%),
        var(--bg);
      color: var(--text);
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
      font-size: 15px;
      line-height: 1.45;
    }
    .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 100vh; }

    /* El menú lateral vive en navigation.styles.ts (etapa 2.1). */
    .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .logo { height: 38px; width: auto; }
    .mascot { height: 46px; width: auto; }

    /* ── Contenido ── */
    main { padding: 32px 36px 80px; min-width: 0; max-width: 1480px; }
    #org-root, .area { scroll-margin-top: 20px; }
    .hero, .area {
      margin-bottom: 40px; padding: 28px 32px 32px; border-radius: 22px;
      border: 1px solid rgb(var(--c-rgb) / .32); background: var(--surface);
    }

    /*
     * ── Vista jerárquica: «centro de mando» (etapa 2.1) ──
     * Fondo más profundo y oscuro que el resto (azul marino → casi negro), con
     * una retícula de 44 px casi imperceptible, iluminación tenue desde arriba,
     * viñeta interior y un radar FIJO (sin animación) arriba a la derecha.
     * Todo queda detrás del contenido (::before/::after en z-index 0, el
     * contenido en 1) y con opacidades ≤ 10 % para no competir con las
     * tarjetas. Las líneas jerárquicas conservan el color de cada coordinación.
     */
    .hero {
      position: relative; isolation: isolate; overflow: hidden;
      border-color: rgba(56,189,248,.26);
      background:
        linear-gradient(rgba(56,189,248,.035) 1px, transparent 1px) 0 0 / 44px 44px,
        linear-gradient(90deg, rgba(56,189,248,.035) 1px, transparent 1px) 0 0 / 44px 44px,
        radial-gradient(ellipse 90% 420px at 50% 0%, rgba(14,116,144,.24), transparent 75%),
        linear-gradient(180deg, #04142e 0%, #020c20 40%, #01060f 100%);
      box-shadow:
        inset 0 1px 0 rgba(125,211,252,.14),
        inset 0 0 120px rgba(0,0,0,.55),
        0 24px 60px -32px rgba(14,116,144,.55);
    }
    .hero > * { position: relative; z-index: 1; }
    /* Radar fijo: anillos, retícula y un sector de barrido estático. */
    .hero::before {
      content: ""; position: absolute; z-index: 0; pointer-events: none;
      top: -150px; right: -150px; width: 640px; height: 640px; border-radius: 50%;
      background:
        conic-gradient(from 200deg at 50% 50%, rgba(34,211,238,.10), transparent 22%),
        repeating-radial-gradient(circle at center, transparent 0 63px, rgba(103,232,249,.09) 63px 64px),
        linear-gradient(90deg, transparent calc(50% - .5px), rgba(103,232,249,.08) 50%, transparent calc(50% + .5px)),
        linear-gradient(0deg, transparent calc(50% - .5px), rgba(103,232,249,.08) 50%, transparent calc(50% + .5px)),
        radial-gradient(circle at center, rgba(34,211,238,.08), transparent 65%);
      -webkit-mask-image: radial-gradient(circle at center, #000 34%, transparent 70%);
      mask-image: radial-gradient(circle at center, #000 34%, transparent 70%);
    }
    /* Halo de profundidad abajo a la izquierda. */
    .hero::after {
      content: ""; position: absolute; z-index: 0; pointer-events: none;
      left: -20%; bottom: -25%; width: 70%; height: 55%;
      background: radial-gradient(ellipse at center, rgba(30,64,175,.16), transparent 70%);
    }
    .hero > .kicker { color: #7dd3fc; }
    .hero > h2 { text-shadow: 0 0 24px rgba(56,189,248,.28); }
    /* Tarjetas y resúmenes con un leve matiz azul para integrarse al fondo. */
    .hero .card { background: linear-gradient(180deg, rgba(8,20,42,.94), rgba(2,8,22,.96)); }
    .hero .summary-box { background: rgba(3,12,30,.62); }

    .area-head {
      margin: 0 0 24px; padding: 16px 20px 18px; border-radius: 14px;
      border-left: 4px solid rgb(var(--c-rgb));
      background: linear-gradient(90deg, rgb(var(--c-rgb) / .14), rgb(var(--c2-rgb) / .04) 55%, transparent 80%);
    }
    .kicker { margin: 0; color: var(--c-text); letter-spacing: .1em; text-transform: uppercase; font-size: 12px; font-weight: 600; }
    h2 { margin: 6px 0 6px; font-size: clamp(22px, 2vw, 26px); line-height: 1.2; }
    .lead { margin: 0 0 16px; color: var(--text-2); font-size: 14px; max-width: 72ch; }
    .area-head .lead { margin-bottom: 0; }
    .subhead { margin: 28px 0 14px; font-size: 15px; line-height: 1.3; color: var(--c-text); }
    .team-count { margin: 12px 0 12px; color: var(--muted); font-size: 13px; }
    .empty { color: var(--muted); font-size: 14px; }

    /* ── Vista jerárquica: líneas del color del responsable ── */
    .org-tree, .org-kids { list-style: none; margin: 0; padding: 0; }
    .org-kids {
      /* La línea toma el color del nodo padre (variable resuelta aquí). */
      --line-rgb: var(--c-rgb);
      margin: 16px 0 4px 26px;
      padding-left: 26px;
      border-left: 2px solid rgb(var(--line-rgb) / .5);
      display: grid;
      gap: 16px;
    }
    .org-kids > .org-node { position: relative; }
    .org-kids > .org-node::before {
      content: ""; position: absolute; left: -26px; top: 36px; width: 18px;
      border-top: 2px solid rgb(var(--line-rgb) / .5);
    }
    .org-node { min-width: 0; }
    /* Escritorio: las tarjetas de responsables no se estiran de lado a lado
       (poco texto en líneas muy largas); en pantallas estrechas ocupan todo. */
    .org-node > .card, .org-node > .summary-box { max-width: 800px; }
    .team > .card { max-width: 640px; }

    /* ── Bloques de área y equipos ── */
    .leader-wrap { max-width: 560px; }
    .teams { display: grid; gap: 22px; margin-top: 14px; }
    .team {
      padding: 20px 22px 22px; border-radius: 18px;
      border: 1px solid rgb(var(--c-rgb) / .24); background: rgba(15,23,42,.42);
    }
    .team.nested {
      margin-top: 18px; padding: 18px 20px 20px; background: rgba(2,6,23,.4);
      border-left: 3px solid rgb(var(--c-rgb) / .5);
    }
    .summary-box {
      margin: 12px 0 4px 12px; padding: 14px 18px; border-radius: 14px;
      border: 1px dashed rgb(var(--c-rgb) / .4); background: rgba(15,23,42,.45);
    }
    .summary-total { margin: 0 0 10px; color: var(--text); font-size: 14px; }
    .summary-total strong { color: var(--c-text); font-size: 20px; margin-right: 4px; }
    .summary-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 18px; }
    .summary-title { margin: 0 0 8px; color: var(--c-text); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 600; }
    .summary-list { list-style: none; margin: 0; padding: 0; }
    .summary-list li {
      display: flex; justify-content: space-between; gap: 12px;
      padding: 6px 0; border-bottom: 1px solid rgba(148,163,184,.14); font-size: 13px; color: var(--text-2);
    }
    .summary-list strong { color: var(--c-text); }
    .summary-empty { margin: 8px 0 0 12px; color: var(--muted); font-size: 13px; }

    /* ── Tarjetas de personas ── */
    .people-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 14px;
      margin-top: 12px;
    }
    .card {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 14px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgb(var(--c-rgb) / .38);
      background: linear-gradient(180deg, rgba(15,23,42,.94), rgba(2,6,23,.96));
      min-width: 0;
    }
    .card.leader {
      grid-template-columns: 64px minmax(0, 1fr);
      padding: 16px 18px;
      border-color: rgb(var(--lead-rgb) / .85);
      /* Indicador de responsable: barra lateral del color de la coordinación. */
      box-shadow: inset 4px 0 0 rgb(var(--lead-rgb)), 0 0 0 1px rgb(var(--lead-rgb) / .12);
    }
    .card.mini { grid-template-columns: 48px minmax(0, 1fr); gap: 12px; padding: 12px 14px; border-radius: 12px; }
    .card.leader.mini { grid-template-columns: 52px minmax(0, 1fr); }
    .photo {
      width: 56px; height: 56px; border-radius: 50%; object-fit: cover;
      border: 2px solid rgb(var(--c-rgb) / .85); background: #0f172a;
    }
    .leader .photo { width: 64px; height: 64px; border-color: rgb(var(--lead-rgb)); }
    .mini .photo { width: 48px; height: 48px; }
    .leader.mini .photo { width: 52px; height: 52px; }
    .initials {
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 700; color: var(--c-text); font-size: 14px; letter-spacing: .02em;
    }
    .leader .initials { color: var(--lead-text); }
    .card-body { min-width: 0; }
    .badge {
      margin: 0 0 4px; color: var(--c-text); font-size: 12px; font-weight: 600;
      letter-spacing: .06em; text-transform: uppercase;
    }
    .leader .badge { color: var(--lead-text); }
    h3 { margin: 0 0 4px; font-size: 16px; line-height: 1.3; overflow-wrap: anywhere; }
    .mini h3 { font-size: 14px; }
    .role, .doc, .area-tag { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
    .role { color: var(--text-2); }
    .doc { margin-top: 3px; font-family: ui-monospace, "Cascadia Mono", Consolas, monospace; font-size: 12px; }
    .area-tag { margin-top: 4px; color: var(--c-text); font-size: 12px; }

    @media (max-width: 1100px) {
      .layout { grid-template-columns: 260px minmax(0, 1fr); }
      main { padding: 28px 24px 64px; }
      .people-grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
    }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      nav { position: static; max-height: none; border-right: 0; border-bottom: 1px solid rgba(34,211,238,.22); }
    }
    @media (max-width: 600px) {
      main { padding: 20px 12px 48px; }
      .hero, .area { padding: 20px 16px 22px; border-radius: 18px; margin-bottom: 28px; }
      .hero::before { top: -110px; right: -130px; width: 400px; height: 400px; }
      .area-head { padding: 14px 14px 16px; margin-bottom: 18px; }
      .team, .team.nested { padding: 16px 14px 18px; }
      .people-grid { grid-template-columns: 1fr; gap: 12px; }
      .org-kids { margin-left: 12px; padding-left: 16px; }
      .org-kids > .org-node::before { left: -16px; width: 10px; }
      .card { grid-template-columns: 52px minmax(0, 1fr); padding: 12px 14px; }
      .card.leader { grid-template-columns: 56px minmax(0, 1fr); }
      .photo { width: 52px; height: 52px; }
      .leader .photo { width: 56px; height: 56px; }
      .mini .photo, .leader.mini .photo { width: 44px; height: 44px; }
      .card.mini, .card.leader.mini { grid-template-columns: 44px minmax(0, 1fr); }
      .summary-box { margin-left: 0; }
    }
`;
