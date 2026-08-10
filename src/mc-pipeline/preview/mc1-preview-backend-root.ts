/**
 * Resolve backend root independent of cwd / dist depth.
 * Walks up from startDir until tmp/mc1-profile-pilot exists.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function resolveBackendRoot(startDir: string = __dirname): string {
  const candidates: string[] = [];

  let cur = resolve(startDir);
  for (let i = 0; i < 10; i++) {
    candidates.push(cur);
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  const cwd = resolve(process.cwd());
  if (!candidates.includes(cwd)) candidates.push(cwd);

  for (const root of candidates) {
    if (existsSync(join(root, 'tmp', 'mc1-profile-pilot'))) {
      return root;
    }
  }

  // Fallback: Nest dist/src/... → four levels; src/... → three levels.
  const fromHere = resolve(startDir, '..', '..', '..');
  if (existsSync(join(fromHere, 'tmp', 'mc1-profile-pilot'))) {
    return fromHere;
  }
  const fromDistSrc = resolve(startDir, '..', '..', '..', '..');
  if (existsSync(join(fromDistSrc, 'tmp', 'mc1-profile-pilot'))) {
    return fromDistSrc;
  }

  throw new Error(
    `Cannot resolve Organigrama_Backend root from ${startDir} (no tmp/mc1-profile-pilot). Tried: ${candidates.join(' | ')}`,
  );
}
