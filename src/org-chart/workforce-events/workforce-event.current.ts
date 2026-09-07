import {
  isWorkforceEventInactiveStatus,
  type WorkforceEventSchedule,
} from './workforce-event.types';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza DATE de PostgreSQL / ISO a `YYYY-MM-DD` (sin desplazamiento TZ). */
export function toDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const prefix = trimmed.slice(0, 10);
    return DATE_ONLY.test(prefix) ? prefix : null;
  }
  if (Number.isNaN(value.getTime())) return null;
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDateOnly(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Una novedad está vigente para el organigrama cuando:
 * - el estado no es REJECTED / CANCELLED
 * - y cubre `today` (sin fechas = abierta; un extremo nulo se trata como abierto)
 */
export function isWorkforceEventCurrent(
  event: WorkforceEventSchedule,
  today: string = todayDateOnly(),
): boolean {
  if (isWorkforceEventInactiveStatus(event.status)) {
    return false;
  }

  const start = event.startDate;
  const end = event.endDate;

  if (!start && !end) {
    return true;
  }
  if (start && today < start) {
    return false;
  }
  if (end && today > end) {
    return false;
  }
  return true;
}
