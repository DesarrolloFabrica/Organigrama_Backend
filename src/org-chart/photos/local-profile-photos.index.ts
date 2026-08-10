/**
 * Índice de fotos locales en `public/profile-photos/{personId}.{ext}`.
 * Se escanea una vez al arrancar (Cloud Run / local) para exponer photoUrl
 * sin I/O por nodo del organigrama.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  webp: 'image/webp',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
};

export type LocalProfilePhotoEntry = {
  absolutePath: string;
  contentType: string;
  fileName: string;
};

@Injectable()
export class LocalProfilePhotosIndex implements OnModuleInit {
  private readonly log = new Logger(LocalProfilePhotosIndex.name);
  private readonly byPersonId = new Map<string, LocalProfilePhotoEntry>();

  onModuleInit(): void {
    this.rescan();
  }

  /** Directorio absoluto `cwd/public/profile-photos`. */
  getDirectory(): string {
    return join(process.cwd(), 'public', 'profile-photos');
  }

  has(personId: string): boolean {
    return this.byPersonId.has(String(personId));
  }

  get(personId: string): LocalProfilePhotoEntry | undefined {
    return this.byPersonId.get(String(personId));
  }

  listPersonIds(): string[] {
    return [...this.byPersonId.keys()];
  }

  rescan(): void {
    this.byPersonId.clear();
    const dir = this.getDirectory();
    if (!existsSync(dir)) {
      this.log.warn(
        `Sin carpeta de fotos locales: ${dir} (personas sin foto local)`,
      );
      return;
    }

    let files: string[];
    try {
      files = readdirSync(dir);
    } catch (err) {
      this.log.warn(
        `No se pudo leer ${dir}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return;
    }

    for (const fileName of files) {
      const match = /^(\d+)\.(webp|jpe?g|png|gif)$/i.exec(fileName);
      if (!match) continue;

      const personId = match[1];
      const ext = match[2].toLowerCase();
      const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
      const next: LocalProfilePhotoEntry = {
        absolutePath: join(dir, fileName),
        contentType,
        fileName,
      };

      const existing = this.byPersonId.get(personId);
      if (!existing || ext === 'webp') {
        this.byPersonId.set(personId, next);
      }
    }

    this.log.log(
      `Fotos locales indexadas: ${this.byPersonId.size} en ${dir}` +
        (this.byPersonId.size > 0
          ? ` [${this.listPersonIds().join(', ')}]`
          : ''),
    );
  }
}
