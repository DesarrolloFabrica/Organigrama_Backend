import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrgNode } from '../types/org-node.type';
import { OrgChartVisibilityService } from '../org-chart-visibility.service';
import type { OrgViewerContext } from '../org-viewer-context';
import {
  isWorkforceEventCurrent,
  toDateOnly,
} from './workforce-event.current';
import type {
  OrgNodeWorkforceEventDto,
  WorkforceEventItemDto,
  WorkforceEventListResponseDto,
} from './dto/workforce-event.response.dto';

const LOG_TAG = '[OrgChartWorkforceEvents]';
const LIST_LIMIT = 50;
const PERSON_ID_RE = /^\d+$/;

type EventRow = {
  id: string;
  person_id: string;
  event_type_id: string | number;
  event_type_name: string;
  observation: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  created_by_person_id: string | null;
  created_by_person_name: string | null;
};

type CurrentEventRow = {
  id: string;
  person_id: string;
  event_type_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: Date | string;
};

/**
 * Lectura de `workforce_events` (schema Orbit) para el organigrama.
 *
 * Organigrama NO escribe: altas, PATCH de estado y log viven en Orbit.
 * Si el schema no está disponible, devolvemos listas vacías (no 500).
 */
@Injectable()
export class OrgChartWorkforceEventsService {
  private readonly log = new Logger(OrgChartWorkforceEventsService.name);
  private missingSchemaLogged = false;
  private schemaUnavailable = false;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly visibility: OrgChartVisibilityService,
  ) {}

  /**
   * Historial de novedades de una persona.
   * Misma visibilidad que la ficha completa: sin permiso → `{ items: [] }`
   * sin revelar si existen registros.
   */
  async listByPersonId(
    viewer: OrgViewerContext,
    targetPersonId: string,
    versionId: string,
  ): Promise<WorkforceEventListResponseDto> {
    const personId = String(targetPersonId).trim();
    if (!PERSON_ID_RE.test(personId)) {
      return { items: [] };
    }

    const canView = await this.visibility.canViewFullProfile(
      viewer,
      personId,
      versionId,
    );
    if (!canView) {
      this.log.warn(
        `${LOG_TAG} denied list viewerPersonId=${viewer.personId} targetPersonId=${personId}`,
      );
      return { items: [] };
    }

    if (this.schemaUnavailable) {
      return { items: [] };
    }

    try {
      const rows = await this.dataSource.query<EventRow[]>(
        `SELECT
           e.id::text AS id,
           e.person_id::text AS person_id,
           e.event_type_id::text AS event_type_id,
           t.name AS event_type_name,
           NULLIF(BTRIM(e.observation), '') AS observation,
           e.status,
           to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
           to_char(e.end_date, 'YYYY-MM-DD') AS end_date,
           to_char(e.start_time, 'HH24:MI') AS start_time,
           to_char(e.end_time, 'HH24:MI') AS end_time,
           e.created_at,
           e.updated_at,
           creator.id::text AS created_by_person_id,
           creator.full_name AS created_by_person_name
         FROM workforce_events.event e
         INNER JOIN workforce_events.event_type t ON t.id = e.event_type_id
         LEFT JOIN core.person creator ON creator.id = e.created_by_person_id
         WHERE e.person_id = $1
         ORDER BY e.created_at DESC
         LIMIT $2`,
        [personId, LIST_LIMIT],
      );

      return { items: rows.map((row) => this.toItemDto(row)) };
    } catch (error) {
      return this.onQueryFailure('listByPersonId', error, { items: [] });
    }
  }

  /**
   * Adjunta la novedad vigente (si hay) a cada nodo del árbol, sin mutar
   * el objeto cacheado del organigrama.
   */
  async attachCurrentToTree(node: OrgNode): Promise<OrgNode> {
    const ids = new Set<string>();
    collectPersonIds(node, ids);
    const currentByPerson = await this.getCurrentByPersonIds([...ids]);
    return mapTreeWithCurrent(node, currentByPerson);
  }

  async attachCurrentToNodes(nodes: OrgNode[]): Promise<OrgNode[]> {
    if (nodes.length === 0) return nodes;
    const ids = new Set<string>();
    for (const node of nodes) {
      collectPersonIds(node, ids);
    }
    const currentByPerson = await this.getCurrentByPersonIds([...ids]);
    return nodes.map((node) => mapTreeWithCurrent(node, currentByPerson));
  }

  async getCurrentByPersonIds(
    personIds: string[],
  ): Promise<Map<string, { event: OrgNodeWorkforceEventDto; count: number }>> {
    const result = new Map<
      string,
      { event: OrgNodeWorkforceEventDto; count: number }
    >();
    const ids = uniqueNumericIds(personIds);
    if (ids.length === 0) return result;
    if (this.schemaUnavailable) return result;

    try {
      const rows = await this.dataSource.query<CurrentEventRow[]>(
        `SELECT
           e.id::text AS id,
           e.person_id::text AS person_id,
           t.name AS event_type_name,
           e.status,
           to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
           to_char(e.end_date, 'YYYY-MM-DD') AS end_date,
           e.created_at
         FROM workforce_events.event e
         INNER JOIN workforce_events.event_type t ON t.id = e.event_type_id
         WHERE e.person_id = ANY($1::bigint[])
           AND e.status NOT IN ('REJECTED', 'CANCELLED')
           AND (
             (e.start_date IS NULL AND e.end_date IS NULL)
             OR (
               CURRENT_DATE >= COALESCE(e.start_date, CURRENT_DATE)
               AND CURRENT_DATE <= COALESCE(e.end_date, CURRENT_DATE)
             )
           )
         ORDER BY e.person_id ASC, e.created_at DESC`,
        [ids],
      );

      const grouped = new Map<string, CurrentEventRow[]>();
      for (const row of rows) {
        const personId = String(row.person_id);
        const list = grouped.get(personId);
        if (list) {
          list.push(row);
        } else {
          grouped.set(personId, [row]);
        }
      }

      for (const [personId, list] of grouped) {
        const primary = list[0];
        if (!primary) continue;
        result.set(personId, {
          count: list.length,
          event: {
            id: String(primary.id),
            eventTypeName: primary.event_type_name,
            status: primary.status,
            startDate: toDateOnly(primary.start_date),
            endDate: toDateOnly(primary.end_date),
          },
        });
      }

      return result;
    } catch (error) {
      return this.onQueryFailure(
        'getCurrentByPersonIds',
        error,
        result,
      );
    }
  }

  private toItemDto(row: EventRow): WorkforceEventItemDto {
    const startDate = toDateOnly(row.start_date);
    const endDate = toDateOnly(row.end_date);
    return {
      id: String(row.id),
      eventTypeId: String(row.event_type_id),
      eventTypeName: row.event_type_name,
      observation: row.observation ?? null,
      status: row.status,
      startDate,
      endDate,
      startTime: toTimeHm(row.start_time),
      endTime: toTimeHm(row.end_time),
      createdAt: toIso(row.created_at),
      updatedAt: toIso(row.updated_at),
      createdByPerson: row.created_by_person_id
        ? {
            id: String(row.created_by_person_id),
            name: row.created_by_person_name ?? null,
          }
        : null,
      isCurrent: isWorkforceEventCurrent({
        status: row.status,
        startDate,
        endDate,
      }),
    };
  }

  private onQueryFailure<T>(op: string, error: unknown, fallback: T): T {
    if (isMissingWorkforceEventsSchema(error)) {
      this.schemaUnavailable = true;
      if (!this.missingSchemaLogged) {
        this.missingSchemaLogged = true;
        this.log.warn(
          `${LOG_TAG} schema workforce_events no disponible; novedades omitidas`,
        );
      }
      return fallback;
    }
    this.log.error(
      `${LOG_TAG} ${op} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return fallback;
  }
}

function collectPersonIds(node: OrgNode, ids: Set<string>): void {
  if (node.id) ids.add(String(node.id));
  for (const child of node.children ?? []) {
    collectPersonIds(child, ids);
  }
}

function mapTreeWithCurrent(
  node: OrgNode,
  currentByPerson: Map<string, { event: OrgNodeWorkforceEventDto; count: number }>,
): OrgNode {
  const current = currentByPerson.get(String(node.id));
  return {
    ...node,
    current_workforce_event: current?.event ?? null,
    current_workforce_event_count: current?.count ?? 0,
    children: (node.children ?? []).map((child) =>
      mapTreeWithCurrent(child, currentByPerson),
    ),
  };
}

function uniqueNumericIds(ids: string[]): string[] {
  const unique = new Set<string>();
  for (const id of ids) {
    const value = String(id).trim();
    if (PERSON_ID_RE.test(value)) unique.add(value);
  }
  return [...unique];
}

function toTimeHm(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? null;
}

function toIso(value: Date | string | null | undefined): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return value;
  }
  return new Date(0).toISOString();
}

export function isMissingWorkforceEventsSchema(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  if (code === '42P01') return true;
  const message = error instanceof Error ? error.message : String(error);
  return (
    /workforce_events/i.test(message) &&
    /does not exist|no existe|undefined table/i.test(message)
  );
}
