import { Injectable } from '@nestjs/common';
import type { Person } from '../person/entities/person.entity';

@Injectable()
export class ProfileCompletionService {
  private static readonly DOCUMENT_MIN_DIGITS = 6;
  private static readonly DOCUMENT_PATTERN = /^\d+$/;

  isDocumentValid(document: string | null | undefined): boolean {
    const trimmed = document?.trim() ?? '';
    return (
      trimmed.length >= ProfileCompletionService.DOCUMENT_MIN_DIGITS &&
      ProfileCompletionService.DOCUMENT_PATTERN.test(trimmed)
    );
  }

  isPhonePresent(person: Person): boolean {
    return Boolean(person.phone?.trim());
  }

  isEmergencyContactComplete(person: Person): boolean {
    return (
      Boolean(person.emergency_contact_name?.trim()) &&
      Boolean(person.emergency_contact_phone?.trim()) &&
      Boolean(person.emergency_contact_relationship?.trim())
    );
  }

  listMissingFields(person: Person): string[] {
    const missing: string[] = [];

    if (!this.isDocumentValid(person.document)) {
      missing.push('document');
    }

    if (!this.isPhonePresent(person)) {
      missing.push('phone');
    }

    if (!person.emergency_contact_name?.trim()) {
      missing.push('emergency_contact_name');
    }

    if (!person.emergency_contact_phone?.trim()) {
      missing.push('emergency_contact_phone');
    }

    if (!person.emergency_contact_relationship?.trim()) {
      missing.push('emergency_contact_relationship');
    }

    return missing;
  }

  canMarkProfileComplete(person: Person): boolean {
    return this.listMissingFields(person).length === 0;
  }

  isProfileCompleted(profileCompletedAt: Date | null): boolean {
    return profileCompletedAt != null;
  }
}
