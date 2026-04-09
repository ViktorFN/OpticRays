import { AppState, Globals } from '../types';

export const defaultGlobals: Globals = {
  colorType: 0,
  wavelength: 550,
  angle: 0,
  beamWidth: 50,
  dispersion: 0.03,
  envN: 1.0,
  intensity: 1.0,
  gridSize: 20,
  snapping: false,
  rayCount: 2000,
};

export function createEmptyState(): AppState {
  return {
    elements: [],
    lightSource: { x: 0, y: 0, dragging: false, initialized: false },
    globals: { ...defaultGlobals },
    selectedElements: [],
    camera: { x: 0, y: 0, zoom: 1 },
  };
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `id-${Math.random().toString(36).slice(2, 11)}`;
}

export function cloneDeep<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => cloneDeep(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, cloneDeep(entry)]);
    return Object.fromEntries(entries) as T;
  }

  return value;
}

export function normalizeLoadedState(value: Partial<AppState>): AppState {
  const base = createEmptyState();

  return {
    ...base,
    ...cloneDeep(value),
    elements: cloneDeep(value.elements ?? base.elements),
    lightSource: {
      ...base.lightSource,
      ...(value.lightSource ?? {}),
    },
    globals: {
      ...base.globals,
      ...(value.globals ?? {}),
    },
    selectedElements: [...(value.selectedElements ?? base.selectedElements)],
    camera: {
      ...base.camera,
      ...(value.camera ?? {}),
    },
  };
}

export function serializeState(state: AppState): string {
  return JSON.stringify(state);
}
