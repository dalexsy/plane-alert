export type DocData = Record<string, unknown>;
export type Store = Record<string, Record<string, DocData>>;

export const DELETE_FIELD = Symbol('delete');
export const INCREMENT_FIELD = Symbol('increment');

export type WhereClause =
  | { type: 'eq'; field: string; value: unknown }
  | { type: 'gte'; field: string; value: unknown }
  | { type: 'lt'; field: string; value: unknown };

export function applyPatch(
  existing: DocData | undefined,
  patch: DocData,
  merge: boolean,
): DocData {
  if (!merge) {
    return normalizeWrite(patch);
  }
  const next: DocData = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === DELETE_FIELD) {
      delete next[key];
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      INCREMENT_FIELD in (value as Record<symbol, number>)
    ) {
      const delta = (value as Record<symbol, number>)[INCREMENT_FIELD];
      const current = typeof next[key] === 'number' ? (next[key] as number) : 0;
      next[key] = current + delta;
      continue;
    }
    next[key] = value;
  }
  return next;
}

export function normalizeWrite(data: DocData): DocData {
  const next: DocData = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === DELETE_FIELD) {
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      INCREMENT_FIELD in (value as Record<symbol, number>)
    ) {
      next[key] = (value as Record<symbol, number>)[INCREMENT_FIELD];
      continue;
    }
    next[key] = value;
  }
  return next;
}

function resolveFilterField(field: string): string {
  if (field === '__name__' || field.includes('documentId')) {
    return '__name__';
  }
  return field;
}

export function normalizeWhereField(field: unknown): string {
  if (typeof field === 'string') {
    return resolveFilterField(field);
  }
  if (
    field &&
    typeof field === 'object' &&
    'segments' in field &&
    Array.isArray((field as { segments?: unknown }).segments)
  ) {
    const segments = (field as { segments: string[] }).segments;
    if (segments.includes('__name__')) {
      return '__name__';
    }
    return segments.join('.');
  }
  return '__name__';
}

export function matchesFilters(
  docId: string,
  data: DocData,
  filters: WhereClause[],
): boolean {
  for (const filter of filters) {
    const fieldName = resolveFilterField(filter.field);
    const fieldValue = fieldName === '__name__' ? docId : data[fieldName];
    if (filter.type === 'eq' && fieldValue !== filter.value) {
      return false;
    }
    if (
      filter.type === 'gte' &&
      !(
        typeof fieldValue === 'string' &&
        typeof filter.value === 'string' &&
        fieldValue >= filter.value
      )
    ) {
      return false;
    }
    if (
      filter.type === 'lt' &&
      !(
        (typeof fieldValue === 'string' &&
          typeof filter.value === 'string' &&
          fieldValue < filter.value) ||
        (typeof fieldValue === 'number' &&
          typeof filter.value === 'number' &&
          fieldValue < filter.value)
      )
    ) {
      return false;
    }
  }
  return true;
}
