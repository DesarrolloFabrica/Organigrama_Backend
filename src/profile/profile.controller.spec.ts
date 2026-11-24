import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_SESSION_REQUEST_KEY } from '../auth/auth.types';
import { ProfileController } from './profile.controller';
import type { ProfileService } from './profile.service';

/**
 * PATCH /api/profile/person/:personId (PersonContactEditor). Mismas reglas que
 * la versión desplegada: la propia persona o ORG_ADMIN de la sesión. Datos
 * sintéticos.
 */
describe('ProfileController.updatePersonContact', () => {
  const body = { phone: '3000000000' };
  let updateProfileMe: jest.Mock;
  let controller: ProfileController;

  function request(personId: string, permissions: string[] = []): Request {
    return {
      [AUTH_SESSION_REQUEST_KEY]: {
        personId,
        googleSubject: 'sub-sintetico',
        eduEmail: 'qa_sintetico@example.test',
        permissions,
      },
    } as unknown as Request;
  }

  beforeEach(() => {
    updateProfileMe = jest.fn().mockResolvedValue({ personId: 'x' });
    controller = new ProfileController({
      updateProfileMe,
    } as unknown as ProfileService);
  });

  it('la propia persona puede editar sus datos', async () => {
    await controller.updatePersonContact(request('10'), '10', body);
    expect(updateProfileMe).toHaveBeenCalledWith('10', body);
  });

  it('ORG_ADMIN puede editar los datos de otra persona', async () => {
    await controller.updatePersonContact(
      request('10', ['ORG_ADMIN']),
      '20',
      body,
    );
    expect(updateProfileMe).toHaveBeenCalledWith('20', body);
  });

  it.each([
    [[]],
    [['ORG_READ_ALL']],
    [['ORG_CONTACT_READ_ALL']],
    [['ORG_DIRECTORY_EXPORT_HTML', 'ORG_DIRECTORY_EXPORT_XLS']],
  ])(
    'otra persona sin ORG_ADMIN (%j) → 403 sin tocar el servicio',
    (permissions: string[]) => {
      expect(() =>
        controller.updatePersonContact(request('10', permissions), '20', body),
      ).toThrow(ForbiddenException);
      expect(updateProfileMe).not.toHaveBeenCalled();
    },
  );

  it('compara ids como texto (10 ≠ 100)', () => {
    expect(() =>
      controller.updatePersonContact(request('10'), '100', body),
    ).toThrow(ForbiddenException);
  });
});
