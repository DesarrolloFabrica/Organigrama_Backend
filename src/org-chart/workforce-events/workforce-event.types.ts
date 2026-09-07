/**
 * Estados de `workforce_events.event.status` (valores exactos del check constraint).
 * Organigrama solo lee; Orbit es quien escribe altas y cambios de estado.
 */
export const WORKFORCE_EVENT_STATUSES = [
  'NOT_TAKEN',
  'PENDING',
  'APPROVED',
  'TAKEN',
  'REJECTED',
  'CANCELLED',
] as const;

export type WorkforceEventStatus = (typeof WORKFORCE_EVENT_STATUSES)[number];

/** Estados que ya no afectan la presencia / agenda de la persona. */
export const WORKFORCE_EVENT_INACTIVE_STATUSES = [
  'REJECTED',
  'CANCELLED',
] as const;

export type WorkforceEventInactiveStatus =
  (typeof WORKFORCE_EVENT_INACTIVE_STATUSES)[number];

export function isWorkforceEventStatus(
  value: string,
): value is WorkforceEventStatus {
  return (WORKFORCE_EVENT_STATUSES as readonly string[]).includes(value);
}

export function isWorkforceEventInactiveStatus(
  value: string,
): value is WorkforceEventInactiveStatus {
  return (WORKFORCE_EVENT_INACTIVE_STATUSES as readonly string[]).includes(
    value,
  );
}

/** Campos de agenda usados para decidir si una novedad está vigente hoy. */
export type WorkforceEventSchedule = {
  status: string;
  startDate: string | null;
  endDate: string | null;
};
