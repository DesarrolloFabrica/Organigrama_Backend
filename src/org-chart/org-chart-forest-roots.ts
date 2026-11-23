export type OrgVisualEdgeIds = {
  parentId: string;
  childId: string;
};

/**
 * Personas que encabezan el bosque de una versión: tienen hijos y nadie más
 * (distinto de ellas mismas) las tiene como hija.
 * Una arista persona → ella misma no cuenta como equipo ni como padre.
 */
export function selectForestRootIds(edges: readonly OrgVisualEdgeIds[]): string[] {
  const parents = new Set<string>();
  const childrenOfSomeoneElse = new Set<string>();

  for (const edge of edges) {
    const parentId = String(edge.parentId);
    const childId = String(edge.childId);
    if (!parentId || !childId || parentId === childId) continue;
    parents.add(parentId);
    childrenOfSomeoneElse.add(childId);
  }

  return [...parents]
    .filter((id) => !childrenOfSomeoneElse.has(id))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}
