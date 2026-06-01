/** Id de la persona raíz del organigrama en Core (GET /org-chart/root). */
export const ORG_CHART_ROOT_PERSON_ID = '1144';

export function isOrgChartPhotosEnabled(): boolean {
  return process.env.ORG_CHART_PHOTOS_ENABLED === 'true';
}

export function isGoogleWorkspacePhotosEnabled(): boolean {
  return process.env.GOOGLE_WORKSPACE_PHOTOS_ENABLED === 'true';
}

export function getOrgChartPhotoTestUrl(): string | null {
  const url = process.env.ORG_CHART_PHOTO_TEST_URL?.trim();
  return url || null;
}

export function isRootMockEligible(personId: string): boolean {
  return (
    Boolean(getOrgChartPhotoTestUrl()) &&
    String(personId) === ORG_CHART_ROOT_PERSON_ID
  );
}

export function getApiPublicBaseUrl(): string {
  const configured = process.env.API_PUBLIC_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  const port = process.env.PORT?.trim() || '3000';
  return `http://localhost:${port}`;
}

export function getPhotoCacheTtlMs(): number {
  const raw = process.env.ORG_CHART_PHOTO_CACHE_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  if (process.env.NODE_ENV === 'development') {
    return 30_000;
  }
  return 86_400_000;
}

export function getPhotoNegativeCacheTtlMs(): number {
  const raw = process.env.ORG_CHART_PHOTO_NEGATIVE_CACHE_TTL_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3_600_000;
}

export function getPhotoFetchConcurrency(): number {
  const raw = process.env.ORG_CHART_PHOTO_FETCH_CONCURRENCY?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
}
