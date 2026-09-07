import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { OrgChartVersion } from './entities/org-chart-version.entity';
import { DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS } from './org-chart-versioning.constants';
import { OrgChartVersionService } from './org-chart-version.service';
import type { OrgViewerContext } from './org-viewer-context';

function versionAdminViewer(
  eduEmail: string = DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS[0],
  personId = '1229',
): OrgViewerContext {
  return {
    personId,
    eduEmail,
    permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
  };
}

function normalViewer(): OrgViewerContext {
  return {
    personId: '999',
    eduEmail: 'otro_usuario@cun.edu.co',
    permissions: [],
  };
}

describe('OrgChartVersionService', () => {
  let service: OrgChartVersionService;
  let versionsRepo: jest.Mocked<
    Pick<Repository<OrgChartVersion>, 'findOne' | 'find'>
  >;

  beforeEach(async () => {
    versionsRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartVersionService,
        {
          provide: getRepositoryToken(OrgChartVersion),
          useValue: versionsRepo,
        },
        {
          provide: getRepositoryToken(Person),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { createQueryRunner: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(OrgChartVersionService);
  });

  describe('canUseVersioning', () => {
    it.each(DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS)(
      'true para correo autorizado %s',
      (eduEmail) => {
        expect(
          service.canUseVersioning(versionAdminViewer(eduEmail, '100')),
        ).toBe(true);
      },
    );

    it('false para usuario normal', () => {
      expect(service.canUseVersioning(normalViewer())).toBe(false);
    });

    it('false para ORG_READ_ALL sin correo autorizado', () => {
      expect(
        service.canUseVersioning({
          personId: '100',
          eduEmail: 'admin.generico@cun.edu.co',
          permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
        }),
      ).toBe(false);
    });

    it('false si falta email correcto', () => {
      expect(
        service.canUseVersioning({
          personId: '1229',
          eduEmail: 'otro@cun.edu.co',
          permissions: [],
        }),
      ).toBe(false);
    });
  });

  describe('resolveVersionForRequest', () => {
    it('usa versión activa si no hay parámetros', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '1',
        code: 'current',
        is_active: true,
      } as OrgChartVersion);

      await expect(
        service.resolveVersionForRequest(normalViewer(), {}),
      ).resolves.toBe('1');
    });

    it('403 si usuario normal pide versionId', async () => {
      await expect(
        service.resolveVersionForRequest(normalViewer(), { versionId: '2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 si usuario normal envía versionId y versionCode', async () => {
      await expect(
        service.resolveVersionForRequest(normalViewer(), {
          versionId: '2',
          versionCode: 'borrador',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('404 si versión no existe', async () => {
      versionsRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.resolveVersionForRequest(versionAdminViewer(), {
          versionId: '99',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('resuelve versión solicitada para usuario técnico', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '2',
        code: '2026-06',
        is_active: false,
      } as OrgChartVersion);

      await expect(
        service.resolveVersionForRequest(versionAdminViewer(), { versionId: '2' }),
      ).resolves.toBe('2');
    });

    it('400 si versionId es una versión de coordinación', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '9',
        code: 'fabrica-contenidos',
        is_active: false,
        scope_type: 'COORDINATION',
      } as OrgChartVersion);

      await expect(
        service.resolveVersionForRequest(versionAdminViewer(), {
          versionId: '9',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resolveReadPlan', () => {
    it('sin scopeVersionId usa overlays activos de coordinación', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '1',
        code: 'current',
        is_active: true,
        scope_type: 'GLOBAL',
      } as OrgChartVersion);
      versionsRepo.find.mockResolvedValueOnce([
        {
          id: '9',
          code: 'fabrica-contenidos',
          name: 'Fábrica de contenidos',
          is_active: true,
          scope_type: 'COORDINATION',
          scope_code: 'fabrica-contenidos',
          scope_label: 'Fábrica de contenidos',
          scope_root_person_id: '49',
        } as OrgChartVersion,
      ]);

      await expect(
        service.resolveReadPlan(normalViewer(), {}),
      ).resolves.toMatchObject({
        globalVersionId: '1',
        overlays: [
          {
            versionId: '9',
            scopeCode: 'fabrica-contenidos',
            rootPersonId: '49',
          },
        ],
      });
    });

    it('scopeVersionId=none deja el subárbol en la versión global', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '1',
        code: 'current',
        is_active: true,
        scope_type: 'GLOBAL',
      } as OrgChartVersion);

      await expect(
        service.resolveReadPlan(versionAdminViewer(), {
          scopeVersionId: 'none',
        }),
      ).resolves.toMatchObject({
        globalVersionId: '1',
        overlays: [],
        cacheKey: 'g1|onone',
      });
    });

    it('scopeVersionId=none no exige permiso de versiones', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '1',
        code: 'current',
        is_active: true,
        scope_type: 'GLOBAL',
      } as OrgChartVersion);

      await expect(
        service.resolveReadPlan(normalViewer(), {
          scopeVersionId: 'none',
        }),
      ).resolves.toMatchObject({
        globalVersionId: '1',
        overlays: [],
      });
    });
  });

  describe('createSnapshot', () => {
    it('403 para usuario normal', async () => {
      await expect(
        service.createSnapshot(normalViewer(), {
          sourceVersionId: 1,
          code: 'test',
          name: 'Test',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('Conflict si code ya existe', async () => {
      versionsRepo.findOne
        .mockResolvedValueOnce({ id: '1' } as OrgChartVersion)
        .mockResolvedValueOnce({ id: '5', code: 'dup' } as OrgChartVersion);

      await expect(
        service.createSnapshot(versionAdminViewer(), {
          sourceVersionId: 1,
          code: 'dup',
          name: 'Dup',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('assertVersionEditable', () => {
    it('permite editar borrador no activo para usuario técnico', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '4',
        code: 'borrador-nueva-plantilla',
        is_active: false,
        is_locked: false,
      } as OrgChartVersion);

      await expect(
        service.assertVersionEditable(versionAdminViewer(), '4'),
      ).resolves.toMatchObject({ code: 'borrador-nueva-plantilla' });
    });

    it('403 para usuario normal', async () => {
      await expect(
        service.assertVersionEditable(normalViewer(), '4'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 si versión está bloqueada', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '3',
        code: 'periodo-febrero-junio-2026',
        is_active: false,
        is_locked: true,
      } as OrgChartVersion);

      await expect(
        service.assertVersionEditable(versionAdminViewer(), '3'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('403 si versión está activa (current)', async () => {
      versionsRepo.findOne.mockResolvedValueOnce({
        id: '1',
        code: 'current',
        is_active: true,
        is_locked: false,
      } as OrgChartVersion);

      await expect(
        service.assertVersionEditable(versionAdminViewer(), '1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
