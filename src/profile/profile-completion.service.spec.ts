import { ProfileCompletionService } from './profile-completion.service';
import type { Person } from '../person/entities/person.entity';

describe('ProfileCompletionService', () => {
  const service = new ProfileCompletionService();

  const basePerson = {
    document: null,
    phone: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relationship: null,
  } as Person;

  it('exige documento numérico de al menos 6 dígitos', () => {
    expect(service.isDocumentValid('12345')).toBe(false);
    expect(service.isDocumentValid('123456')).toBe(true);
    expect(service.isDocumentValid('12A456')).toBe(false);
  });

  it('lista campos obligatorios para completar onboarding', () => {
    expect(service.listMissingFields(basePerson)).toEqual([
      'document',
      'phone',
      'emergency_contact_name',
      'emergency_contact_phone',
      'emergency_contact_relationship',
    ]);
  });

  it('permite completar cuando todo está presente', () => {
    const person = {
      document: '1234567890',
      phone: '3001234567',
      emergency_contact_name: 'María Pérez',
      emergency_contact_phone: '3100000000',
      emergency_contact_relationship: 'Hermana',
    } as Person;

    expect(service.listMissingFields(person)).toEqual([]);
    expect(service.canMarkProfileComplete(person)).toBe(true);
  });
});
