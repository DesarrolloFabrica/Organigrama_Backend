import { BadRequestException } from '@nestjs/common';
import { QueryFailedError, type Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { PersonProfileState } from './entities/person-profile-state.entity';
import { ProfileCompletionService } from './profile-completion.service';
import { ProfileService } from './profile.service';

type AnyRepo<T> = jest.Mocked<Pick<Repository<T>, 'findOne' | 'save'>>;

function buildActivePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: '1081',
    document: '1020720408',
    edu_email: 'tania_rocha@cun.edu.co',
    is_active: true,
    full_name: 'TANIA LIZETH ROCHA CONTRERAS',
    phone: null,
    email: null,
    address: null,
    role_id: null,
    hierarchy_id: null,
    area_id: null,
    school_id: null,
    program_id: null,
    type_document: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
    ...overrides,
  } as unknown as Person;
}

function buildState(): PersonProfileState {
  return {
    person_id: '1081',
    profile_completed_at: null,
    profile_updated_by_user_at: null,
    profile_photo_source: null,
    profile_photo_url: null,
  } as unknown as PersonProfileState;
}

describe('ProfileService - validación de documento (anti-regresión)', () => {
  let persons: AnyRepo<Person>;
  let profileStates: AnyRepo<PersonProfileState>;
  let catalogRepo: AnyRepo<unknown>;
  let service: ProfileService;
  const personId = '1081';

  beforeEach(() => {
    persons = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    profileStates = {
      findOne: jest.fn().mockResolvedValue(buildState()),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };
    catalogRepo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };

    service = new ProfileService(
      persons as unknown as Repository<Person>,
      profileStates as unknown as Repository<PersonProfileState>,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      new ProfileCompletionService(),
      { invalidateForPerson: jest.fn() } as never,
      { clearResponseCaches: jest.fn() } as never,
    );
  });

  /**
   * findOne se usa en dos lugares: requireActiveCollaborator (where.is_active)
   * y assertDocumentNotTakenByOther (where.document). Diferenciamos por la
   * forma del where.
   */
  function wireFindOne(options: {
    activePerson: Person | null;
    conflictingPerson: Person | null;
  }) {
    persons.findOne.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      if (where.is_active !== undefined) {
        return Promise.resolve(options.activePerson);
      }
      return Promise.resolve(options.conflictingPerson);
    });
  }

  it('permite guardar el MISMO documento del propio usuario sin error', async () => {
    const me = buildActivePerson();
    wireFindOne({ activePerson: me, conflictingPerson: null });
    persons.save.mockImplementation((p) => Promise.resolve(p));

    await expect(
      service.updateProfileMe(personId, { document: '1020720408' }),
    ).resolves.toMatchObject({ personId: '1081' });

    expect(persons.save).toHaveBeenCalledTimes(1);
    const conflictCall = persons.findOne.mock.calls.find(
      ([a]: any) => a?.where?.document !== undefined,
    );
    expect(conflictCall).toBeDefined();
  });

  it('rechaza un documento que pertenece a OTRA persona', async () => {
    const me = buildActivePerson({ document: '999999999' });
    const other = buildActivePerson({ id: '2002', document: '1020720408' });
    wireFindOne({ activePerson: me, conflictingPerson: other });

    await expect(
      service.updateProfileMe(personId, { document: '1020720408' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateProfileMe(personId, { document: '1020720408' }),
    ).rejects.toThrow('Ese número de documento ya está registrado por otra persona');

    expect(persons.save).not.toHaveBeenCalled();
  });

  it('NO ejecuta la validación de documento si dto.document no viene', async () => {
    const me = buildActivePerson();
    wireFindOne({ activePerson: me, conflictingPerson: null });
    persons.save.mockImplementation((p) => Promise.resolve(p));

    await service.updateProfileMe(personId, { phone: '3001234567' });

    const conflictCall = persons.findOne.mock.calls.find(
      ([a]: any) => a?.where?.document !== undefined,
    );
    expect(conflictCall).toBeUndefined();
    expect(persons.save).toHaveBeenCalledTimes(1);
  });

  it('mantiene el catch de 23505 como respaldo (condición de carrera)', async () => {
    const me = buildActivePerson();
    wireFindOne({ activePerson: me, conflictingPerson: null });

    const dbError = new QueryFailedError('UPDATE core.person', [], {
      code: '23505',
      constraint: 'person_document_key',
    } as never);
    persons.save.mockRejectedValue(dbError);

    await expect(
      service.updateProfileMe(personId, { phone: '3001234567' }),
    ).rejects.toThrow('Ese número de documento ya está registrado por otra persona');
  });
});

describe('ProfileService - validación de correo personal (anti-regresión)', () => {
  let persons: AnyRepo<Person>;
  let profileStates: AnyRepo<PersonProfileState>;
  let catalogRepo: AnyRepo<unknown>;
  let service: ProfileService;
  const personId = '1081';

  beforeEach(() => {
    persons = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    profileStates = {
      findOne: jest.fn().mockResolvedValue(buildState()),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
    };
    catalogRepo = { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() };

    service = new ProfileService(
      persons as unknown as Repository<Person>,
      profileStates as unknown as Repository<PersonProfileState>,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      catalogRepo as never,
      new ProfileCompletionService(),
      { invalidateForPerson: jest.fn() } as never,
      { clearResponseCaches: jest.fn() } as never,
    );
  });

  /**
   * findOne se usa en requireActiveCollaborator (where.is_active),
   * assertDocumentNotTakenByOther (where.document) y
   * assertEmailNotTakenByOther (where.email).
   */
  function wireFindOne(options: {
    activePerson: Person | null;
    conflictingByEmail: Person | null;
  }) {
    persons.findOne.mockImplementation((args: any) => {
      const where = args?.where ?? {};
      if (where.is_active !== undefined) {
        return Promise.resolve(options.activePerson);
      }
      if (where.email !== undefined) {
        return Promise.resolve(options.conflictingByEmail);
      }
      return Promise.resolve(null);
    });
  }

  it('permite guardar el MISMO correo del propio usuario sin error', async () => {
    const me = buildActivePerson({ email: 'tania.personal@gmail.com' });
    wireFindOne({ activePerson: me, conflictingByEmail: null });
    persons.save.mockImplementation((p) => Promise.resolve(p));

    await expect(
      service.updateProfileMe(personId, { email: 'tania.personal@gmail.com' }),
    ).resolves.toMatchObject({ personId: '1081' });

    expect(persons.save).toHaveBeenCalledTimes(1);
    const emailCall = persons.findOne.mock.calls.find(
      ([a]: any) => a?.where?.email !== undefined,
    );
    expect(emailCall).toBeDefined();
  });

  it('rechaza un correo que pertenece a OTRA persona', async () => {
    const me = buildActivePerson({ email: 'tania.old@gmail.com' });
    const other = buildActivePerson({
      id: '3003',
      email: 'compartido@gmail.com',
    });
    wireFindOne({ activePerson: me, conflictingByEmail: other });

    await expect(
      service.updateProfileMe(personId, { email: 'compartido@gmail.com' }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updateProfileMe(personId, { email: 'compartido@gmail.com' }),
    ).rejects.toThrow('Ese correo personal ya está registrado por otra persona');

    expect(persons.save).not.toHaveBeenCalled();
  });

  it('NO ejecuta la validación de correo si dto.email no viene', async () => {
    const me = buildActivePerson();
    wireFindOne({ activePerson: me, conflictingByEmail: null });
    persons.save.mockImplementation((p) => Promise.resolve(p));

    await service.updateProfileMe(personId, { phone: '3001234567' });

    const emailCall = persons.findOne.mock.calls.find(
      ([a]: any) => a?.where?.email !== undefined,
    );
    expect(emailCall).toBeUndefined();
    expect(persons.save).toHaveBeenCalledTimes(1);
  });

  it('mantiene el catch de 23505 (person_email_key) como respaldo', async () => {
    const me = buildActivePerson();
    wireFindOne({ activePerson: me, conflictingByEmail: null });

    const dbError = new QueryFailedError('UPDATE core.person', [], {
      code: '23505',
      constraint: 'person_email_key',
    } as never);
    persons.save.mockRejectedValue(dbError);

    await expect(
      service.updateProfileMe(personId, { phone: '3001234567' }),
    ).rejects.toThrow('Ese correo personal ya está registrado por otra persona');
  });
});
