import {
  isCollaboratorEduEmail,
  normalizeInstitutionalEmail,
} from './auth-email.util';

describe('auth-email.util', () => {
  it('normaliza punto y guion bajo en el mismo correo', () => {
    expect(
      normalizeInstitutionalEmail('camilo.quintero@cun.edu.co'),
    ).toBe('camilo_quintero@cun.edu.co');
    expect(
      normalizeInstitutionalEmail('camilo_quintero@cun.edu.co'),
    ).toBe('camilo_quintero@cun.edu.co');
  });

  it('rechaza dominios distintos a cun.edu.co', () => {
    expect(normalizeInstitutionalEmail('user@gmail.com')).toBeNull();
  });

  it('identifica colaboradores solo con _ en edu_email', () => {
    expect(isCollaboratorEduEmail('camilo_quintero@cun.edu.co')).toBe(true);
    expect(isCollaboratorEduEmail('camilo.quintero@cun.edu.co')).toBe(false);
  });
});
