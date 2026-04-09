import { AppState } from '../types';

export const PRESETS: Record<string, Partial<AppState>> = {
  'Микроскоп': {
    elements: [
      { id: 'm1', type: 'lens', x: 400, y: 300, rotation: 0, n: 1.6, lensType: 'convex', curvatureRadius: 100, height: 120, thickness: 40 },
      { id: 'm2', type: 'lens', x: 600, y: 300, rotation: 0, n: 1.6, lensType: 'convex', curvatureRadius: 150, height: 150, thickness: 30 },
      { id: 'm3', type: 'polygon', x: 300, y: 300, rotation: 0, n: 1.5, vertices: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 10, y: 10 }, { x: -10, y: 10 }], scattering: 0.05 },
    ],
    lightSource: { x: 200, y: 300, dragging: false, initialized: true },
    globals: { colorType: 0, wavelength: 550, angle: 0, beamWidth: 20, dispersion: 0.02, envN: 1.0, intensity: 1.5, gridSize: 20, snapping: false, rayCount: 2000 },
  },
  'Телескоп Кеплера': {
    elements: [
      { id: 't1', type: 'lens', x: 300, y: 300, rotation: 0, n: 1.5, lensType: 'convex', curvatureRadius: 300, height: 250, thickness: 40 },
      { id: 't2', type: 'lens', x: 700, y: 300, rotation: 0, n: 1.5, lensType: 'convex', curvatureRadius: 80, height: 60, thickness: 20 },
    ],
    lightSource: { x: 50, y: 300, dragging: false, initialized: true },
    globals: { colorType: 0, wavelength: 550, angle: 0, beamWidth: 200, dispersion: 0.01, envN: 1.0, intensity: 1.0, gridSize: 20, snapping: false, rayCount: 2000 },
  },
  'Радуга': {
    elements: [
      { id: 'r1', type: 'raindrop', x: 500, y: 300, rotation: 0, n: 1.333, radius: 120, absorption: 0, scattering: 0 },
    ],
    lightSource: { x: 300, y: 240, dragging: false, initialized: true },
    globals: { colorType: 0, wavelength: 550, angle: 15, beamWidth: 100, dispersion: 0.04, envN: 1.0, intensity: 2.0, gridSize: 20, snapping: false, rayCount: 2000 },
  },
  'Мираж (градиент)': {
    elements: [
      { id: 'g1', type: 'polygon', x: 600, y: 400, rotation: 0, n: 1.0, vertices: [{ x: -400, y: -50 }, { x: 400, y: -50 }, { x: 400, y: 50 }, { x: -400, y: 50 }], grin: 0.002 },
    ],
    lightSource: { x: 150, y: 380, dragging: false, initialized: true },
    globals: { colorType: 0, wavelength: 550, angle: 5, beamWidth: 10, dispersion: 0, envN: 1.0, intensity: 1.5, gridSize: 20, snapping: false, rayCount: 2000 },
  },
};
