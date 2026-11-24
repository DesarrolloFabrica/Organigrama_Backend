import { xmlEscape } from './org-chart-directory-export.util';

export type PresentationPerson = {
  personId: string;
  /**
   * Todos los jefes efectivos (Organigrama no tiene relación principal): la
   * persona se pinta bajo cada uno que esté en el informe, como en el mapa,
   * y se cuenta una sola vez en los totales.
   */
  bossIds: string[];
  /**
   * Nombres de sus jefes registrados que están inactivos. Si ninguno de sus
   * jefes está en el informe por esa causa, va a la sección «Jefe registrado
   * inactivo» en lugar de aparecer como raíz junto a la Dirección.
   */
  inactiveBossNames: string[];
  fullName: string;
  document: string;
  roleName: string;
  areaName: string;
  photoUrl: string;
};

export type PresentationArtwork = {
  logoUrl?: string;
  submarineUrl?: string;
};

type TreeNode = PresentationPerson & { children: TreeNode[] };

type AreaSection = {
  area: string;
  anchor: string;
  count: number;
  coordinator: PresentationPerson | null;
  members: PresentationPerson[];
  depth: number;
};

function safePhotoUrl(value: string): string {
  const url = value.trim();
  if (!/^https:\/\//i.test(url)) return '';
  return url.replace(/"/g, '%22');
}

function areaLabel(areaName: string): string {
  const name = areaName.trim();
  return name || 'Sin área';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

function areaAnchor(area: string, index: number): string {
  const slug = area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `area-${index}-${slug || 'sin-area'}`;
}

function isCoordinatorRole(roleName: string): boolean {
  return roleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('coordinador');
}

function isDirectorRole(roleName: string): boolean {
  const normalized = roleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return normalized.includes('director');
}

function rootPriority(person: PresentationPerson): number {
  if (isDirectorRole(person.roleName)) return 0;
  if (isCoordinatorRole(person.roleName)) return 1;
  return 2;
}

export function buildPresentationForest(
  people: PresentationPerson[],
): TreeNode[] {
  const ids = new Set(people.map((person) => person.personId));
  const childrenByBoss = new Map<string, PresentationPerson[]>();
  for (const person of people) {
    const bossKeys = presentParentIds(person, ids);
    for (const bossKey of bossKeys.length > 0 ? bossKeys : ['']) {
      const list = childrenByBoss.get(bossKey) ?? [];
      list.push(person);
      childrenByBoss.set(bossKey, list);
    }
  }
  for (const list of childrenByBoss.values()) {
    list.sort((a, b) => {
      const priority = rootPriority(a) - rootPriority(b);
      if (priority !== 0) return priority;
      return a.fullName.localeCompare(b.fullName, 'es');
    });
  }

  const visit = (person: PresentationPerson, seen: Set<string>): TreeNode => {
    const nextSeen = new Set(seen);
    nextSeen.add(person.personId);
    const children = (childrenByBoss.get(person.personId) ?? [])
      .filter((child) => !nextSeen.has(child.personId))
      .map((child) => visit(child, nextSeen));
    return { ...person, children };
  };

  const roots = [...(childrenByBoss.get('') ?? [])].sort((a, b) => {
    const priority = rootPriority(a) - rootPriority(b);
    if (priority !== 0) return priority;
    return a.fullName.localeCompare(b.fullName, 'es');
  });
  return roots.map((person) => visit(person, new Set()));
}

/** Jefes de la persona presentes en el conjunto (sin repetir ni a sí misma). */
function presentParentIds(
  person: PresentationPerson,
  ids: ReadonlySet<string>,
): string[] {
  return [...new Set(person.bossIds)].filter(
    (bossId) => bossId !== person.personId && ids.has(bossId),
  );
}

/**
 * Persona activa cuyo jefe registrado está inactivo y que no cuelga de ningún
 * jefe presente en el informe. Su relación no se modifica: solo se presenta
 * en una sección diferenciada.
 */
function isUnderInactiveBossOnly(
  person: PresentationPerson,
  ids: ReadonlySet<string>,
): boolean {
  return (
    person.inactiveBossNames.length > 0 &&
    presentParentIds(person, ids).length === 0
  );
}

function descendantCount(node: TreeNode): number {
  return collectDescendants(node).length;
}

function pickCoordinator(
  members: PresentationPerson[],
  forest: TreeNode[],
): PresentationPerson | null {
  if (members.length === 0) return null;
  const ranked = [...forest].sort((a, b) => {
    const roleDelta =
      Number(isCoordinatorRole(b.roleName) || isDirectorRole(b.roleName)) -
      Number(isCoordinatorRole(a.roleName) || isDirectorRole(a.roleName));
    if (roleDelta !== 0) return roleDelta;
    const sizeDelta = descendantCount(b) - descendantCount(a);
    if (sizeDelta !== 0) return sizeDelta;
    return a.fullName.localeCompare(b.fullName, 'es');
  });
  if (ranked[0]) return ranked[0];
  return (
    [...members].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'es'),
    )[0] ?? null
  );
}

/** Orden de áreas según aparición en el árbol global (Iron → Raúl → equipos). */
function buildAreaSections(people: PresentationPerson[]): AreaSection[] {
  const byArea = new Map<string, PresentationPerson[]>();
  for (const person of people) {
    const area = areaLabel(person.areaName);
    const list = byArea.get(area) ?? [];
    list.push(person);
    byArea.set(area, list);
  }

  const forest = buildPresentationForest(people);
  const areaOrder = new Map<string, number>();
  const areaDepth = new Map<string, number>();
  let order = 0;
  const walk = (node: TreeNode, depth: number): void => {
    const area = areaLabel(node.areaName);
    if (!areaOrder.has(area)) {
      areaOrder.set(area, order);
      areaDepth.set(area, depth);
      order += 1;
    }
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const root of forest) walk(root, 0);

  for (const area of byArea.keys()) {
    if (!areaOrder.has(area)) {
      areaOrder.set(area, order);
      areaDepth.set(area, 999);
      order += 1;
    }
  }

  return [...byArea.entries()]
    .sort((a, b) => {
      const orderDelta =
        (areaOrder.get(a[0]) ?? 999) - (areaOrder.get(b[0]) ?? 999);
      if (orderDelta !== 0) return orderDelta;
      return a[0].localeCompare(b[0], 'es');
    })
    .map(([area, members], index) => {
      const localForest = buildPresentationForest(members);
      const coordinator = pickCoordinator(members, localForest);
      const orderedMembers = [...members].sort((a, b) => {
        if (coordinator && a.personId === coordinator.personId) return -1;
        if (coordinator && b.personId === coordinator.personId) return 1;
        return a.fullName.localeCompare(b.fullName, 'es');
      });
      return {
        area,
        anchor: areaAnchor(area, index),
        count: members.length,
        coordinator,
        members: orderedMembers,
        depth: areaDepth.get(area) ?? 999,
      };
    });
}

function normalizeRole(roleName: string): string {
  return roleName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isLeaderRole(roleName: string): boolean {
  const normalized = normalizeRole(roleName);
  return (
    normalized.includes('director') ||
    normalized.includes('coordinador') ||
    normalized.includes('lider') ||
    normalized.includes('supervisor')
  );
}

function isStaffAnalystRole(roleName: string): boolean {
  const normalized = normalizeRole(roleName);
  return normalized.includes('analista operativo');
}

/** Personas que sí aparecen en la vista jerárquica compacta. */
function isHierarchyAnchor(person: PresentationPerson): boolean {
  return (
    isDirectorRole(person.roleName) ||
    isCoordinatorRole(person.roleName) ||
    isLeaderRole(person.roleName) ||
    isStaffAnalystRole(person.roleName)
  );
}

/**
 * Descendientes distintos del nodo. Una persona con varios jefes puede estar
 * más de una vez en el subárbol; en los totales se cuenta una sola vez.
 */
function collectDescendants(node: TreeNode): PresentationPerson[] {
  const rows: PresentationPerson[] = [];
  const seen = new Set<string>([node.personId]);
  const walk = (current: TreeNode): void => {
    for (const child of current.children) {
      if (!seen.has(child.personId)) {
        seen.add(child.personId);
        rows.push(child);
      }
      walk(child);
    }
  };
  walk(node);
  return rows;
}

function renderSubtreeSummary(node: TreeNode): string {
  const descendants = collectDescendants(node);
  if (descendants.length === 0) {
    return '<p class="summary-empty">Sin colaboradores a cargo</p>';
  }
  const byArea = new Map<string, number>();
  const byRole = new Map<string, number>();
  for (const person of descendants) {
    const area = areaLabel(person.areaName);
    const role = person.roleName.trim() || 'Sin cargo';
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
    byRole.set(role, (byRole.get(role) ?? 0) + 1);
  }
  const areaRows = [...byArea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(
      ([area, count]) =>
        `<li><span>${xmlEscape(area)}</span><strong>${count}</strong></li>`,
    )
    .join('');
  const roleRows = [...byRole.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
    .map(
      ([role, count]) =>
        `<li><span>${xmlEscape(role)}</span><strong>${count}</strong></li>`,
    )
    .join('');
  return `<div class="summary-box">
    <p class="summary-total"><strong>${descendants.length}</strong> colaboradores a cargo</p>
    <div class="summary-cols">
      <div>
        <p class="summary-title">Por área</p>
        <ul class="summary-list">${areaRows}</ul>
      </div>
      <div>
        <p class="summary-title">Por rol</p>
        <ul class="summary-list">${roleRows}</ul>
      </div>
    </div>
  </div>`;
}

function isFabricaArea(area: string): boolean {
  return area
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .includes('fabrica');
}

function leaderBadge(person: PresentationPerson, isLeader: boolean): string {
  if (isStaffAnalystRole(person.roleName)) return 'Analista';
  if (!isLeader) return 'Colaborador';
  if (isDirectorRole(person.roleName)) return 'Dirección';
  if (isCoordinatorRole(person.roleName)) return 'Coordinador';
  if (normalizeRole(person.roleName).includes('supervisor')) return 'Líder';
  if (isLeaderRole(person.roleName)) return 'Líder';
  return 'Líder del área';
}

function renderCard(
  person: PresentationPerson,
  options: {
    leader?: boolean;
    compact?: boolean;
    mini?: boolean;
    depth?: number;
    /** Línea adicional (texto plano) bajo el cargo, con el mismo estilo. */
    note?: string;
  } = {},
): string {
  const photo = safePhotoUrl(person.photoUrl);
  const image = photo
    ? `<img class="photo" src="${photo}" alt="" loading="lazy" />`
    : `<span class="photo initials">${xmlEscape(initials(person.fullName))}</span>`;
  const leader = Boolean(options.leader);
  const depth = options.depth ?? 0;
  const classes = [
    'card',
    leader ? 'leader' : '',
    options.compact ? 'compact' : '',
    options.mini ? 'mini' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<article class="${classes}" style="--depth:${depth}">
    ${image}
    <div class="card-body">
      ${options.mini ? '' : `<p class="badge">${xmlEscape(leaderBadge(person, leader))}</p>`}
      <h3>${xmlEscape(person.fullName)}</h3>
      <p class="role">${xmlEscape(person.roleName || 'Sin cargo')}</p>
      ${options.note ? `<p class="role">${xmlEscape(options.note)}</p>` : ''}
      <p class="doc">Cédula ${xmlEscape(person.document || '—')}</p>
      ${options.mini ? '' : `<p class="area-tag">${xmlEscape(areaLabel(person.areaName))}</p>`}
    </div>
  </article>`;
}

function renderPeopleGrid(people: TreeNode[] | PresentationPerson[]): string {
  if (people.length === 0) return '<p class="empty">Sin colaboradores.</p>';
  return `<div class="people-grid">${people
    .map((person) => renderCard(person, { compact: true, mini: true }))
    .join('')}</div>`;
}

/**
 * Vista jerárquica compacta:
 * Iron → Raúl → coordinadores / líderes (Jonh) / analistas (Sara, Ximena, Lorena).
 * El resto del equipo solo aparece como conteo por área y por rol.
 */
function renderHierarchyList(node: TreeNode, depth = 0): string {
  const leader =
    depth <= 1 ||
    isDirectorRole(node.roleName) ||
    isCoordinatorRole(node.roleName) ||
    isLeaderRole(node.roleName);

  if (depth >= 2) {
    return `<li class="org-node">
      ${renderCard(node, {
        leader,
        compact: true,
        mini: true,
        depth,
      })}
      ${node.children.length > 0 ? renderSubtreeSummary(node) : ''}
    </li>`;
  }

  const visibleChildren = node.children.filter((child) =>
    depth === 0 ? true : isHierarchyAnchor(child),
  );
  const children =
    visibleChildren.length > 0
      ? `<ul class="org-kids">${visibleChildren
          .map((child) => renderHierarchyList(child, depth + 1))
          .join('')}</ul>`
      : '';
  return `<li class="org-node">
    ${renderCard(node, {
      leader: true,
      compact: true,
      mini: depth > 0,
      depth,
    })}
    ${children}
  </li>`;
}

/** Área tipo Fábrica: coordinador + líderes pequeños con su equipo. */
function renderTeamBlocks(node: TreeNode): string {
  const managers = node.children.filter((child) => child.children.length > 0);
  const leaves = node.children.filter((child) => child.children.length === 0);
  const managerBlocks = managers
    .map((manager) => {
      const nestedManagers = manager.children.filter(
        (child) => child.children.length > 0,
      );
      const nestedLeaves = manager.children.filter(
        (child) => child.children.length === 0,
      );
      const nested =
        nestedManagers.length > 0
          ? nestedManagers
              .map(
                (nestedManager) => `<div class="team nested">
              ${renderCard(nestedManager, { leader: true, compact: true, mini: true })}
              <p class="team-count">${nestedManager.children.length} en el equipo</p>
              ${renderPeopleGrid(nestedManager.children)}
            </div>`,
              )
              .join('')
          : '';
      return `<div class="team">
        ${renderCard(manager, { leader: true, compact: true })}
        <p class="team-count">${manager.children.length} en el equipo</p>
        ${nestedLeaves.length > 0 ? renderPeopleGrid(nestedLeaves) : ''}
        ${nested}
      </div>`;
    })
    .join('');
  const leafGrid = leaves.length > 0 ? renderPeopleGrid(leaves) : '';
  return `${managerBlocks}${leafGrid}`;
}

function renderAreaSection(section: AreaSection): string {
  const localForest = buildPresentationForest(section.members);
  const coordinator =
    section.coordinator &&
    localForest.find((node) => node.personId === section.coordinator?.personId);
  const roots =
    coordinator == null
      ? localForest
      : [
          { ...coordinator, children: coordinator.children },
          ...localForest.filter(
            (node) => node.personId !== coordinator.personId,
          ),
        ];

  const useTeams =
    isFabricaArea(section.area) ||
    roots.some((node) =>
      node.children.some((child) => child.children.length > 0),
    );

  let body: string;
  if (useTeams && roots.length > 0) {
    const primary = roots[0];
    const extras = roots.slice(1);
    body = `<div class="leader-wrap">${renderCard(primary, { leader: true, compact: true })}</div>
      <h3 class="subhead">Equipos por líder · ${primary.children.length} reportes directos</h3>
      <div class="teams">${renderTeamBlocks(primary)}</div>
      ${extras
        .map(
          (root) => `<div class="team">
            ${renderCard(root, { leader: true, compact: true })}
            ${renderTeamBlocks(root)}
          </div>`,
        )
        .join('')}`;
  } else {
    const coordinatorPerson = section.coordinator;
    const collaborators = section.members.filter(
      (person) => person.personId !== coordinatorPerson?.personId,
    );
    body = `<div class="leader-wrap">${
      coordinatorPerson
        ? renderCard(coordinatorPerson, { leader: true, compact: true })
        : '<p class="empty">Sin líder de área.</p>'
    }</div>
      <h3 class="subhead">Colaboradores · ${collaborators.length}</h3>
      ${renderPeopleGrid(collaborators)}`;
  }

  return `<section class="area" id="${section.anchor}">
    <header class="area-head">
      <p class="kicker">Área · ${section.count} personas</p>
      <h2>${xmlEscape(section.area)}</h2>
      <p class="lead">Líder: ${xmlEscape(section.coordinator?.fullName || 'Sin líder')}</p>
    </header>
    ${body}
  </section>`;
}

export const INACTIVE_BOSS_SECTION_ID = 'jefe-registrado-inactivo';

/**
 * Sección diferenciada para quienes cuelgan solo de un jefe inactivo: se
 * conservan con su jefe registrado (marcado «(inactivo)») y su equipo, si lo
 * tienen, como conteo. Reutiliza los estilos de las áreas.
 */
function renderInactiveBossSection(roots: TreeNode[]): string {
  const cards = roots
    .map((node) => {
      const note = `Jefe registrado: ${node.inactiveBossNames
        .map((name) => `${name || 'Sin nombre'} (inactivo)`)
        .join(' | ')}`;
      return `<div class="team">
        ${renderCard(node, { compact: true, note })}
        ${node.children.length > 0 ? renderSubtreeSummary(node) : ''}
      </div>`;
    })
    .join('');
  return `<section class="area" id="${INACTIVE_BOSS_SECTION_ID}">
    <header class="area-head">
      <p class="kicker">Revisión · ${roots.length} personas</p>
      <h2>Jefe registrado inactivo</h2>
      <p class="lead">Personas activas cuyo jefe registrado en el organigrama está inactivo. Se conserva la relación tal como está registrada; cada persona también aparece en su área.</p>
    </header>
    <div class="teams">${cards}</div>
  </section>`;
}

export function buildOrgChartHtml(
  people: PresentationPerson[],
  versionLabel: string,
  artwork: PresentationArtwork = {},
): string {
  const ids = new Set(people.map((person) => person.personId));
  const fullForest = buildPresentationForest(people);
  // Quien solo cuelga de un jefe inactivo no es una raíz de la organización:
  // va a su sección (con su equipo) en lugar de mezclarse con la Dirección.
  const forest = fullForest.filter(
    (node) => !isUnderInactiveBossOnly(node, ids),
  );
  const inactiveBossRoots = fullForest.filter((node) =>
    isUnderInactiveBossOnly(node, ids),
  );
  const sections = buildAreaSections(people);
  const logo = safePhotoUrl(artwork.logoUrl ?? '');
  const submarine = safePhotoUrl(artwork.submarineUrl ?? '');
  const brand = [
    logo ? `<img class="logo" src="${logo}" alt="Organigramas OP" />` : '',
    submarine ? `<img class="mascot" src="${submarine}" alt="" />` : '',
  ].join('');

  const nav = [
    `<a class="nav-home" href="#org-root"><span>Vista jerárquica</span><strong>${people.length}</strong></a>`,
    ...sections.map(
      (section) =>
        `<a href="#${section.anchor}"><span>${xmlEscape(section.area)}</span><strong>${section.count}</strong></a>`,
    ),
    ...(inactiveBossRoots.length > 0
      ? [
          `<a href="#${INACTIVE_BOSS_SECTION_ID}"><span>Jefe registrado inactivo</span><strong>${inactiveBossRoots.length}</strong></a>`,
        ]
      : []),
  ].join('');

  const hierarchy =
    forest.length === 0
      ? '<p class="empty">Sin personas en el organigrama activo.</p>'
      : `<ul class="org-tree">${forest.map((node) => renderHierarchyList(node)).join('')}</ul>`;

  const areaBlocks = sections.map(renderAreaSection).join('');
  const inactiveBossBlock =
    inactiveBossRoots.length > 0
      ? renderInactiveBossSection(inactiveBossRoots)
      : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Organigrama OP — ${xmlEscape(versionLabel)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 20% 0%, rgba(8,47,73,.9), transparent 42%),
        radial-gradient(circle at 80% 10%, rgba(14,116,144,.35), transparent 35%),
        #020617;
      color: #e2e8f0;
      font-family: "Segoe UI", sans-serif;
    }
    .layout { display: grid; grid-template-columns: 270px 1fr; min-height: 100vh; }
    nav {
      position: sticky; top: 0; align-self: start; max-height: 100vh; overflow: auto;
      padding: 18px 12px; border-right: 1px solid rgba(34,211,238,.25); background: rgba(2,6,23,.92);
    }
    nav h1 { margin: 0 0 6px; font-size: 17px; }
    nav .meta { margin: 0 0 12px; color: #94a3b8; font-size: 12px; }
    nav a {
      display: flex; justify-content: space-between; gap: 8px; margin-bottom: 5px;
      padding: 8px 9px; border-radius: 10px; color: inherit; text-decoration: none;
      border: 1px solid rgba(34,211,238,.22); background: rgba(8,47,73,.4); font-size: 12px;
    }
    nav a.nav-home { border-color: rgba(245,158,11,.55); background: rgba(120,53,15,.35); }
    nav a:hover, nav a:focus { border-color: #22d3ee; outline: none; }
    nav strong { color: #a5f3fc; }
    .brand { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .logo { height: 36px; width: auto; }
    .mascot { height: 44px; width: auto; }
    main { padding: 22px 22px 64px; min-width: 0; }
    #org-root, .area { scroll-margin-top: 16px; }
    .hero, .area {
      margin-bottom: 28px; padding: 16px; border-radius: 18px;
      border: 1px solid rgba(34,211,238,.22); background: rgba(2,6,23,.5);
    }
    .kicker { margin: 0; color: #67e8f9; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; }
    h2 { margin: 4px 0; font-size: 22px; }
    .lead { margin: 0 0 12px; color: #cbd5e1; font-size: 13px; }
    .subhead { margin: 16px 0 10px; font-size: 13px; color: #a5f3fc; }
    .team-count { margin: 4px 0 8px; color: #94a3b8; font-size: 11px; }
    .empty { color: #94a3b8; font-size: 13px; }
    .org-tree, .org-kids { list-style: none; margin: 0; padding: 0; }
    .org-kids {
      margin: 8px 0 0 12px;
      padding-left: 10px;
      border-left: 2px solid rgba(34,211,238,.28);
      display: grid;
      gap: 8px;
    }
    .org-node { min-width: 0; }
    .leader-wrap { max-width: 420px; }
    .teams { display: grid; gap: 14px; margin-top: 8px; }
    .team {
      padding: 12px; border-radius: 14px; border: 1px solid rgba(34,211,238,.18);
      background: rgba(8,47,73,.28);
    }
    .team.nested { margin-top: 10px; background: rgba(2,6,23,.35); }
    .summary-box {
      margin: 8px 0 4px 8px; padding: 10px 12px; border-radius: 12px;
      border: 1px dashed rgba(34,211,238,.35); background: rgba(8,47,73,.25);
    }
    .summary-total { margin: 0 0 8px; color: #e2e8f0; font-size: 12px; }
    .summary-total strong { color: #67e8f9; font-size: 16px; }
    .summary-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .summary-title { margin: 0 0 6px; color: #a5f3fc; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
    .summary-list { list-style: none; margin: 0; padding: 0; }
    .summary-list li {
      display: flex; justify-content: space-between; gap: 10px;
      padding: 3px 0; border-bottom: 1px solid rgba(148,163,184,.12); font-size: 11px; color: #cbd5e1;
    }
    .summary-list strong { color: #67e8f9; }
    .summary-empty { margin: 6px 0 0 8px; color: #94a3b8; font-size: 11px; }
    .people-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .card {
      display: grid;
      grid-template-columns: 48px 1fr;
      gap: 8px;
      align-items: center;
      padding: 8px;
      border-radius: 12px;
      border: 1px solid rgba(34,211,238,.35);
      background: linear-gradient(180deg, rgba(8,47,73,.78), rgba(2,6,23,.94));
      min-width: 0;
    }
    .card.leader { border-color: #f59e0b; grid-template-columns: 52px 1fr; }
    .card.mini { grid-template-columns: 36px 1fr; padding: 6px 8px; border-radius: 10px; }
    .photo {
      width: 48px; height: 48px; border-radius: 50%; object-fit: cover;
      border: 2px solid #22d3ee; background: #0f172a;
    }
    .leader .photo { width: 52px; height: 52px; border-color: #f59e0b; }
    .mini .photo { width: 36px; height: 36px; border-width: 1.5px; }
    .initials {
      display: inline-flex; align-items: center; justify-content: center;
      font-weight: 700; color: #a5f3fc; font-size: 11px;
    }
    .badge {
      margin: 0 0 2px; color: #67e8f9; font-size: 9px;
      letter-spacing: .05em; text-transform: uppercase;
    }
    .leader .badge { color: #fbbf24; }
    h3 { margin: 0 0 2px; font-size: 12px; line-height: 1.2; }
    .mini h3 { font-size: 11px; }
    .role, .doc, .area-tag { margin: 0; color: #94a3b8; font-size: 10px; }
    .doc { font-family: ui-monospace, monospace; }
    .area-tag { color: #67e8f9; }
    @media (max-width: 900px) {
      .layout { grid-template-columns: 1fr; }
      nav { position: static; max-height: none; }
    }
  </style>
</head>
<body>
  <div class="layout">
    <nav>
      <div class="brand">${brand}</div>
      <h1>Organigrama OP</h1>
      <p class="meta">${xmlEscape(versionLabel)} · ${people.length} personas</p>
      ${nav}
    </nav>
    <main>
      <section class="hero" id="org-root">
        <p class="kicker">Organización</p>
        <h2>Jerarquía desde la Dirección</h2>
        <p class="lead">Solo Dirección, coordinadores, líderes y analistas de Raúl. El resto aparece como conteo por área y rol; el detalle está en cada área.</p>
        ${hierarchy}
      </section>
      ${areaBlocks}
      ${inactiveBossBlock}
    </main>
  </div>
</body>
</html>`;
}
