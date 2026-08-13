/**
 * Resolve backend root independent of cwd / dist depth.
 * Prefers tmp/mc1-profile-pilot when present; otherwise nest-cli.json / package.json.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function isBackendRoot(root: string): boolean {
  if (existsSync(join(root, 'tmp', 'mc1-profile-pilot'))) {
    return true;
  }
  // tmp/ is gitignored — do not require pilot artifacts to boot Nest.
  if (existsSync(join(root, 'nest-cli.json'))) {
    return true;
  }
  // Production Cloud Run image: package.json + dist/ (no src/, no nest-cli).
  if (
    existsSync(join(root, 'package.json')) &&
    existsSync(join(root, 'dist', 'main.js'))
  ) {
    return true;
  }
  return existsSync(join(root, 'package.json')) && existsSync(join(root, 'src'));
}

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
    if (isBackendRoot(root)) {
      return root;
    }
  }

  // Fallback: Nest dist/src/... → four levels; src/... → three levels.
  const fromHere = resolve(startDir, '..', '..', '..');
  if (isBackendRoot(fromHere)) {
    return fromHere;
  }
  const fromDistSrc = resolve(startDir, '..', '..', '..', '..');
  if (isBackendRoot(fromDistSrc)) {
    return fromDistSrc;
  }

  throw new Error(
    `Cannot resolve Organigrama_Backend root from ${startDir}. Tried: ${candidates.join(' | ')}`,
  );
}
