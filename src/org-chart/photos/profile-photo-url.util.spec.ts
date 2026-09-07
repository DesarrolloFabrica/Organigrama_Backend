import {
  isBundledProfilePhotoPath,
  isLoopbackHttpUrl,
  resolvePublicPhotoUrl,
} from './profile-photo-url.util';

describe('profile-photo-url.util', () => {
  describe('isLoopbackHttpUrl', () => {
    it('detects localhost and 127.0.0.1', () => {
      expect(isLoopbackHttpUrl('http://localhost:3000/public/a.webp')).toBe(
        true,
      );
      expect(isLoopbackHttpUrl('https://127.0.0.1/x.png')).toBe(true);
    });

    it('rejects non-loopback and relative URLs', () => {
      expect(
        isLoopbackHttpUrl(
          'https://organigrama-backend-550902908078.us-central1.run.app/public/a.webp',
        ),
      ).toBe(false);
      expect(isLoopbackHttpUrl('/public/profile-photos/601.webp')).toBe(false);
      expect(isLoopbackHttpUrl(null)).toBe(false);
    });
  });

  describe('isBundledProfilePhotoPath', () => {
    it('detects relative and absolute packaged profile photos', () => {
      expect(isBundledProfilePhotoPath('/public/profile-photos/1141.webp')).toBe(
        true,
      );
      expect(
        isBundledProfilePhotoPath(
          'http://localhost:3000/public/profile-photos/1141.webp',
        ),
      ).toBe(true);
    });

    it('rejects Google, CDN and other public uploads', () => {
      expect(
        isBundledProfilePhotoPath(
          'https://lh3.googleusercontent.com/a/ACg8ocExample',
        ),
      ).toBe(false);
      expect(
        isBundledProfilePhotoPath(
          'https://organigrama-frontend-550902908078.us-central1.run.app/img/Iron.webp',
        ),
      ).toBe(false);
      expect(isBundledProfilePhotoPath(null)).toBe(false);
    });
  });

  describe('resolvePublicPhotoUrl', () => {
    const opts = {
      personId: '601',
      source: 'upload',
      publicBaseUrl: 'https://api.example.com',
    };

    it('ignores localhost URLs persisted from local inserts', () => {
      expect(
        resolvePublicPhotoUrl(
          'http://localhost:3000/public/profile-photos/601.webp',
          opts,
        ),
      ).toBeNull();
    });

    it('keeps absolute public URLs and resolves root-relative paths', () => {
      expect(
        resolvePublicPhotoUrl('https://cdn.example.com/a.webp', opts),
      ).toBe('https://cdn.example.com/a.webp');
      expect(
        resolvePublicPhotoUrl('/public/profile-photos/601.webp', opts),
      ).toBe('https://api.example.com/public/profile-photos/601.webp');
    });
  });
});
