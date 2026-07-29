import {
  MC_CATALOG_CODE,
  MC_CATALOG_VERSION,
} from './mc-catalog.constants';
import {
  MC1_CATALOG_DEFINITION,
  MC_SOFTWARE_DOMAIN_CODE,
  MC_SOFTWARE_SPECIALTY_CODES,
} from './mc-catalog.definition-mc12';
import { computeMcCatalogDefinitionHash } from './mc-catalog.hash';
import { McCatalogError, McCatalogService } from './mc-catalog.service';
import {
  MC_SPECIALTY_LIFECYCLE_STATUSES,
  MC_SPECIALTY_PRESENTATION_STATUSES,
} from './mc-catalog.types';
import type { McCatalogDefinition } from './mc-catalog.types';

describe('definicion MC1 catalogo (contrato)', () => {
  it('usa codigos de catalogo versionados estables', () => {
    expect(MC1_CATALOG_DEFINITION.catalogCode).toBe(MC_CATALOG_CODE);
    expect(MC1_CATALOG_DEFINITION.catalogVersion).toBe(MC_CATALOG_VERSION);
  });

  it('incluye SOFTWARE (7), VISUAL_DESIGN (5) y AUDIOVISUAL_PRODUCTION (3)', () => {
    expect(MC1_CATALOG_DEFINITION.domains).toHaveLength(3);
    const software = MC1_CATALOG_DEFINITION.domains[0];
    expect(software.code).toBe(MC_SOFTWARE_DOMAIN_CODE);
    expect(software.specialties.map((s) => s.code)).toEqual([
      ...MC_SOFTWARE_SPECIALTY_CODES,
    ]);
    const visual = MC1_CATALOG_DEFINITION.domains[1];
    expect(visual.code).toBe('VISUAL_DESIGN');
    expect(visual.specialties).toHaveLength(5);
    expect(visual.specialties.map((s) => s.code)).toEqual([
      'VISUAL_GRAPHIC',
      'VISUAL_IDENTITY',
      'VISUAL_EDITORIAL',
      'VISUAL_DIGITAL_ASSETS',
      'VISUAL_UI',
    ]);
    const av = MC1_CATALOG_DEFINITION.domains[2];
    expect(av.code).toBe('AUDIOVISUAL_PRODUCTION');
    expect(av.specialties.map((s) => s.code)).toEqual([
      'AV_EDITING',
      'AV_MOTION',
      'AV_POST',
    ]);
  });

  it('nombres oficiales SOFTWARE coinciden con MC1.2', () => {
    const byCode = Object.fromEntries(
      MC1_CATALOG_DEFINITION.domains[0].specialties.map((s) => [s.code, s.name]),
    );
    expect(byCode.SOFTWARE_FRONTEND).toBe('Desarrollo frontend');
    expect(byCode.SOFTWARE_BACKEND).toBe('Desarrollo backend');
    expect(byCode.SOFTWARE_DATA).toBe('Bases de datos');
    expect(byCode.SOFTWARE_API_INTEGRATION).toBe(
      'Integraci' + String.fromCharCode(0xf3) + 'n de APIs',
    );
    expect(byCode.SOFTWARE_CLOUD_DEPLOY).toBe('Cloud y despliegue');
    expect(byCode.SOFTWARE_ENGINEERING_QUALITY).toBe(
      'Ingenier' + String.fromCharCode(0xed) + 'a y calidad de software',
    );
    expect(byCode.SOFTWARE_AI_APPLIED).toBe('IA aplicada al desarrollo');
  });

  it('no incluye Arquitectura como especialidad', () => {
    const codes = MC1_CATALOG_DEFINITION.domains[0].specialties.map(
      (s) => s.code,
    );
    expect(codes.some((c) => /ARCHITECT/i.test(c))).toBe(false);
  });

  it('siembra especialidades oficiales con lifecycle ACTIVE', () => {
    for (const s of MC1_CATALOG_DEFINITION.domains[0].specialties) {
      expect(s.lifecycleStatus).toBe('ACTIVE');
    }
  });

  it('separa lifecycle de catalogo vs presentacion por perfil', () => {
    expect(MC_SPECIALTY_LIFECYCLE_STATUSES).toEqual([
      'ACTIVE',
      'EXPERIMENTAL',
      'INACTIVE',
    ]);
    expect(MC_SPECIALTY_PRESENTATION_STATUSES).toEqual([
      'ACTIVE',
      'EMERGENT',
      'HIDDEN',
    ]);
    expect(MC_SPECIALTY_LIFECYCLE_STATUSES).not.toContain('EMERGENT');
    expect(MC_SPECIALTY_PRESENTATION_STATUSES).toContain('EMERGENT');
  });

  it('hash de definicion es estable', () => {
    const a = computeMcCatalogDefinitionHash(MC1_CATALOG_DEFINITION);
    const b = computeMcCatalogDefinitionHash(MC1_CATALOG_DEFINITION);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('McCatalogService.validateDefinition', () => {
  const service = new McCatalogService(
    null as never,
    null as never,
    null as never,
    null as never,
  );

  it('acepta la definicion MC1', () => {
    expect(() =>
      service.validateDefinition(MC1_CATALOG_DEFINITION),
    ).not.toThrow();
  });

  it('rechaza EMERGENT como lifecycle de catalogo', () => {
    const bad = structuredClone(MC1_CATALOG_DEFINITION) as McCatalogDefinition & {
      domains: Array<{
        specialties: Array<{ lifecycleStatus: string }>;
      }>;
    };
    bad.domains[0].specialties[0].lifecycleStatus = 'EMERGENT';
    expect(() =>
      service.validateDefinition(bad as McCatalogDefinition),
    ).toThrow(McCatalogError);
    expect(() =>
      service.validateDefinition(bad as McCatalogDefinition),
    ).toThrow(/EMERGENT|lifecycle/);
  });

  it('rechaza codigos de especialidad duplicados', () => {
    const bad: McCatalogDefinition = structuredClone(MC1_CATALOG_DEFINITION);
    bad.domains[0].specialties[1].code = 'SOFTWARE_FRONTEND';
    expect(() => service.validateDefinition(bad)).toThrow(/duplicada/);
  });
});
