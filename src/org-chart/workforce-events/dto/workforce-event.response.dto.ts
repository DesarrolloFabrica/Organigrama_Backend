/** Resumen compacto para badge en nodos del mapa. */
export type OrgNodeWorkforceEventDto = {
  id: string;
  eventTypeName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

/** Ítem de historial en la ficha de persona. */
export type WorkforceEventItemDto = {
  id: string;
  eventTypeId: string;
  eventTypeName: string;
  observation: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  createdAt: string;
  updatedAt: string;
  createdByPerson: {
    id: string;
    name: string | null;
  } | null;
  isCurrent: boolean;
};

export type WorkforceEventListResponseDto = {
  items: WorkforceEventItemDto[];
};
