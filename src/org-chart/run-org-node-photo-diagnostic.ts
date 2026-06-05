import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { OrgChartService } from './org-chart.service';
import { ProfilePhotoLookupService } from './photos/profile-photo-lookup.service';
import { isOrgChartPhotosEnabled } from './photos/photo.config';
import type { OrgNode } from './types/org-node.type';

const TARGET_NAME = 'JOSE ALEJANDRO CAMACHO COBOS';

function findNodeByName(root: OrgNode, name: string): OrgNode | null {
  const norm = name.trim().toUpperCase();
  function walk(node: OrgNode): OrgNode | null {
    if (node.name?.trim().toUpperCase() === norm) {
      return node;
    }
    for (const child of node.children) {
      const hit = walk(child);
      if (hit) return hit;
    }
    return null;
  }
  return walk(root);
}

function pickNodeFields(node: OrgNode) {
  return {
    id: node.id,
    name: node.name,
    nodeKind: node.nodeKind,
    photoUrl: node.photoUrl,
    edu_email: node.edu_email,
    direct_reports_count: node.direct_reports_count,
    childrenCount: node.children.length,
  };
}

/**
 * CLI: evidencia de photoUrl en árbol vs ficha.
 * Uso: npm run diag:org-photo
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const orgChart = app.get(OrgChartService);
    const profilePhoto = app.get(ProfilePhotoLookupService);
    const jwt = app.get(JwtService);
    const dataSource = app.get(DataSource);

    console.log('--- Config ---');
    console.log(
      JSON.stringify(
        {
          ORG_CHART_PHOTOS_ENABLED: isOrgChartPhotosEnabled(),
          NODE_ENV: process.env.NODE_ENV,
          API_PUBLIC_BASE_URL: process.env.API_PUBLIC_BASE_URL ?? null,
        },
        null,
        2,
      ),
    );

    const googleIds = await profilePhoto.findAllGooglePhotoPersonIds();
    console.log('\n--- Overlay: person_ids con foto Google ---');
    console.log(JSON.stringify(googleIds, null, 2));

    orgChart.clearResponseCaches();
    const diagViewerId = process.env.ORG_CHART_DIAG_VIEWER_ID ?? '1144';
    const rootFresh = await orgChart.getOrgChartRoot(diagViewerId);
    const nodeFresh = findNodeByName(rootFresh, TARGET_NAME);

    console.log('\n--- GET /api/org-chart/root (caché limpiada, servicio directo) ---');
    if (!nodeFresh) {
      console.log(`No se encontró nodo "${TARGET_NAME}" en el root.`);
      console.log(
        'Hijos directos del root:',
        rootFresh.children.map((c) => ({ id: c.id, name: c.name, photoUrl: c.photoUrl })),
      );
    } else {
      console.log(JSON.stringify(pickNodeFields(nodeFresh), null, 2));
    }

    const rootCached = await orgChart.getOrgChartRoot(diagViewerId);
    const nodeCached = nodeFresh ? findNodeByName(rootCached, TARGET_NAME) : null;
    console.log('\n--- Segunda llamada getOrgChartRoot (puede ser cache hit) ---');
    console.log(
      JSON.stringify(
        nodeCached ? pickNodeFields(nodeCached) : { found: false },
        null,
        2,
      ),
    );

    const personId =
      nodeFresh?.id ??
      (googleIds.length === 1 ? googleIds[0] : googleIds[0] ?? null);

    if (personId) {
      const state = await profilePhoto.findGooglePhotoState(personId);
      console.log('\n--- Overlay row ---');
      console.log(
        JSON.stringify(
          state
            ? {
                person_id: state.person_id,
                profile_photo_source: state.profile_photo_source,
                profile_photo_url: state.profile_photo_url,
              }
            : null,
          null,
          2,
        ),
      );

      orgChart.clearResponseCaches();
      const detail = await orgChart.getPersonDetail(personId, diagViewerId);
      console.log('\n--- GET /api/org-chart/person/:id (servicio directo) ---');
      console.log(
        JSON.stringify(
          {
            id: detail.id,
            name: detail.name,
            canViewFullProfile: detail.canViewFullProfile,
            photoUrl: detail.photoUrl,
          },
          null,
          2,
        ),
      );

      orgChart.clearResponseCaches();
      const nodeAsRoot = await orgChart.getOrgChartNode(personId, diagViewerId);
      console.log('\n--- GET /api/org-chart/node/:id (persona como raíz del lienzo) ---');
      console.log(JSON.stringify(pickNodeFields(nodeAsRoot), null, 2));

      const parentRows = (await dataSource.query(
        `
        SELECT parent_person_id::text AS parent_id
        FROM organigrama.org_visual_relation
        WHERE child_person_id = $1 AND is_active = true
        LIMIT 5
        `,
        [personId],
      )) as { parent_id: string }[];

      console.log('\n--- Padres visuales en organigrama.org_visual_relation ---');
      console.log(JSON.stringify(parentRows, null, 2));

      for (const row of parentRows) {
        orgChart.clearResponseCaches();
        const siblings = await orgChart.getOrgChartChildren(
          row.parent_id,
          diagViewerId,
        );
        const self = siblings.find(
          (c) =>
            c.name?.trim().toUpperCase() === TARGET_NAME.trim().toUpperCase(),
        );
        console.log(
          `\n--- GET /api/org-chart/children/${row.parent_id} (padre visual) ---`,
        );
        console.log(
          JSON.stringify(
            self
              ? pickNodeFields(self)
              : {
                  message: 'No en hijos directos de este padre',
                  sample: siblings.slice(0, 3).map(pickNodeFields),
                },
            null,
            2,
          ),
        );
      }

      const children = await orgChart.getOrgChartChildren(
        String(rootFresh.id),
        diagViewerId,
      );
      const selfInChildren = children.find(
        (c) => c.name?.trim().toUpperCase() === TARGET_NAME.trim().toUpperCase(),
      );
      console.log('\n--- GET /api/org-chart/children/:parentId (root id) ---');
      if (selfInChildren) {
        console.log(JSON.stringify(pickNodeFields(selfInChildren), null, 2));
      } else {
        console.log(
          `No está en hijos directos del root (${rootFresh.id}). Total hijos: ${children.length}`,
        );
        const partial = children
          .filter((c) => c.name?.toUpperCase().includes('CAMACHO'))
          .map(pickNodeFields);
        if (partial.length) {
          console.log('Nodos con CAMACHO en el nombre:');
          console.log(JSON.stringify(partial, null, 2));
        }
      }

      let httpAvailable = true;
      const token = await jwt.signAsync({
        personId,
        googleSubject: 'diag',
        googleEmail: 'diag@cun.edu.co',
        googlePictureUrl: null,
      });

      const base = (process.env.API_PUBLIC_BASE_URL ?? 'http://localhost:3000')
        .replace(/\/$/, '');
      const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      };

      for (const path of [
        '/api/org-chart/root',
        `/api/org-chart/node/${personId}`,
        `/api/org-chart/person/${personId}`,
        `/api/org-chart/children/${rootFresh.id}`,
      ]) {
        if (!httpAvailable) {
          break;
        }
        let res: Response;
        try {
          res = await fetch(`${base}${path}`, { headers });
        } catch (err) {
          console.log(
            `\n--- HTTP ${path} omitido (servidor no escuchando en ${base}) ---`,
          );
          httpAvailable = false;
          continue;
        }
        const body = (await res.json()) as OrgNode | OrgNode[] | Record<string, unknown>;
        console.log(`\n--- HTTP ${path} status=${res.status} ---`);

        if (path.includes('/person/')) {
          console.log(
            JSON.stringify(
              {
                id: (body as { id?: string }).id,
                full_name: (body as { full_name?: string }).full_name,
                photoUrl: (body as { photoUrl?: string | null }).photoUrl,
              },
              null,
              2,
            ),
          );
          continue;
        }

        const rootBody = body as OrgNode;
        const hit = path.includes('/node/')
          ? pickNodeFields(body as OrgNode)
          : path.includes('/children/')
            ? (() => {
                const n = (body as OrgNode[]).find(
                  (c) =>
                    c.name?.trim().toUpperCase() ===
                    TARGET_NAME.trim().toUpperCase(),
                );
                return n ? pickNodeFields(n) : null;
              })()
            : findNodeByName(rootBody, TARGET_NAME);

        if (hit) {
          console.log(JSON.stringify(hit, null, 2));
        } else if (path.includes('/children/')) {
          console.log(
            JSON.stringify(
              (body as OrgNode[]).slice(0, 5).map(pickNodeFields),
              null,
              2,
            ),
          );
          console.log('(primeros 5 hijos; objetivo no en esta página)');
        } else {
          console.log('Nodo objetivo no encontrado en respuesta HTTP.');
        }
      }
    } else {
      console.log('\nNo se pudo resolver personId para ficha/HTTP.');
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[diag:org-photo] error', err);
  process.exit(1);
});
