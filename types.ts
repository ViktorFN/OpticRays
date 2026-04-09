export type Vector2 = { x: number; y: number };

export type ElementType = 'prism' | 'lens' | 'raindrop' | 'mirror' | 'polygon' | 'fiber' | 'parabolicMirror';

export interface OpticElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  rotation: number;
  n: number;
  absorption?: number;
  scattering?: number;
  
  size?: number;
  
  lensType?: 'convex' | 'concave';
  curvatureRadius?: number;
  height?: number;
  thickness?: number;
  
  radius?: number;
  
  length?: number;
  
  vertices?: Vector2[];
  pts?: Vector2[];
  grin?: number;
  grinDirection?: number;
}

export interface Globals {
  colorType: number;
  wavelength: number;
  angle: number;
  beamWidth: number;
  dispersion: number;
  envN: number;
  intensity: number;
  gridSize: number;
  snapping: boolean;
  rayCount: number;
}

export interface AppState {
  elements: OpticElement[];
  lightSource: { x: number; y: number; dragging: boolean; initialized: boolean };
  globals: Globals;
  selectedElements: number[];
  camera: { x: number; y: number; zoom: number };
}
