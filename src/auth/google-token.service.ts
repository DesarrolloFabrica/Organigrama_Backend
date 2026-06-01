import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { getGoogleClientId } from './auth.config';

export type VerifiedGoogleIdentity = {
  subject: string;
  email: string;
  pictureUrl: string | null;
};

@Injectable()
export class GoogleTokenService {
  private readonly client = new OAuth2Client(getGoogleClientId());

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const token = idToken?.trim();
    if (!token) {
      throw new UnauthorizedException('Token de Google requerido');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken: token,
        audience: getGoogleClientId(),
      });

      const payload = ticket.getPayload();
      const email = payload?.email?.trim().toLowerCase();
      const subject = payload?.sub?.trim();

      if (!email || !subject) {
        throw new UnauthorizedException('Token de Google inválido');
      }

      if (payload?.email_verified === false) {
        throw new UnauthorizedException('Correo de Google no verificado');
      }

      return {
        subject,
        email,
        pictureUrl: payload?.picture?.trim() || null,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }

      throw new UnauthorizedException('No se pudo validar el inicio de sesión con Google');
    }
  }
}
