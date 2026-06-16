import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { OrgChartVersion } from './entities/org-chart-version.entity';
import {
  ORG_CHART_VERSIONING_EDU_EMAIL,
  ORG_CHART_VERSIONING_PERSON_ID,
} from './org-chart-versioning.constants';
import { OrgChartVersionService } from './org-chart-version.service';
import type { OrgViewerContext } from './org-viewer-context';

function technicalViewer(): OrgViewerContext {
  return {
    personId: ORG_CHART_VERSIONING_PERSON_ID,
    eduEmail: ORG_CHART_VERSIONING_EDU_EMAIL,
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

function adminViewerWrongId(): OrgViewerContext {
  return {
    personId: '100',
    eduEmail: ORG_CHART_VERSIONING_EDU_EMAIL,
    permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
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
      find: jest.fn(),
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
    it('true solo para personId 1229 y email desarrollofabrica', () => {
      expect(service.canUseVersioning(technicalViewer())).toBe(true);
    });

    it('false para usuario normal', () => {
      expect(service.canUseVersioning(normalViewer())).toBe(false);
    });

    it('false para ORG_READ_ALL sin personId 1229', () => {
      expect(service.canUseVersioning(adminViewerWrongId())).toBe(false);
    });

    it('false si falta email correcto', () => {
      expect(
        service.canUseVersioning({
          personId: ORG_CHART_VERSIONING_PERSON_ID,
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

    it('404 si versión no existe', async () => {
      versionsRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.resolveVersionForRequest(technicalViewer(), {
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
        service.resolveVersionForRequest(technicalViewer(), { versionId: '2' }),
      ).resolves.toBe('2');
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
        service.createSnapshot(technicalViewer(), {
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
        service.assertVersionEditable(technicalViewer(), '4'),
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
        service.assertVersionEditable(technicalViewer(), '3'),
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
        service.assertVersionEditable(technicalViewer(), '1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
