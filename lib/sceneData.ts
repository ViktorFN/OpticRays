import { getFiberGeometry, getPolygonGeometry, getPrismGeometry, vadd, vec, vrot } from './math';
import { AppState, OpticElement, Vector2 } from '../types';

const MAX_SEGMENTS = 4096;
const GROUP_SIZE = 32;
const MAX_GROUPS = MAX_SEGMENTS / GROUP_SIZE;
const MAX_ARCS = 256;
const MAX_CIRCLES = 256;
const MAX_PARABOLAS = 128;

export interface PackedSceneData {
  segData: Float32Array;
  segmentProps: Float32Array;
  groupBBox: Float32Array;
  arcData: Float32Array;
  arcLimitData: Float32Array;
  arcPropData: Float32Array;
  circleData: Float32Array;
  circlePropData: Float32Array;
  parabolaData: Float32Array;
  parabolaOrientationData: Float32Array;
  segmentCount: number;
  arcCount: number;
  circleCount: number;
  parabolaCount: number;
  groupCount: number;
}

export function buildSceneData(state: AppState): PackedSceneData {
  const segData = new Float32Array(MAX_SEGMENTS * 4);
  const segmentProps = new Float32Array(MAX_SEGMENTS * 4);
  const groupBBox = new Float32Array(MAX_GROUPS * 4);

  for (let i = 0; i < MAX_GROUPS * 4; i += 4) {
    groupBBox[i] = Infinity;
    groupBBox[i + 1] = Infinity;
    groupBBox[i + 2] = -Infinity;
    groupBBox[i + 3] = -Infinity;
  }

  const arcData = new Float32Array(MAX_ARCS * 4);
  const arcLimitData = new Float32Array(MAX_ARCS * 4);
  const arcPropData = new Float32Array(MAX_ARCS * 4);
  const circleData = new Float32Array(MAX_CIRCLES * 3);
  const circlePropData = new Float32Array(MAX_CIRCLES * 4);
  const parabolaData = new Float32Array(MAX_PARABOLAS * 4);
  const parabolaOrientationData = new Float32Array(MAX_PARABOLAS * 4);

  let segmentCount = 0;
  let arcCount = 0;
  let circleCount = 0;
  let parabolaCount = 0;

  const pushArc = (
    cx: number,
    cy: number,
    radius: number,
    dirX: number,
    dirY: number,
    cosHalfAngle: number,
    normalSign: number,
    element: OpticElement
  ) => {
    if (arcCount >= MAX_ARCS) return;

    const angle = (element.rotation || 0) * Math.PI / 180;
    const rotatedCenter = vadd(vec(element.x, element.y), vrot(vec(cx, cy), angle));
    const rotatedDirection = vrot(vec(dirX, dirY), angle);

    arcData[arcCount * 4] = rotatedCenter.x;
    arcData[arcCount * 4 + 1] = rotatedCenter.y;
    arcData[arcCount * 4 + 2] = radius;
    arcData[arcCount * 4 + 3] = normalSign;

    arcLimitData[arcCount * 4] = rotatedDirection.x;
    arcLimitData[arcCount * 4 + 1] = rotatedDirection.y;
    arcLimitData[arcCount * 4 + 2] = cosHalfAngle;
    arcLimitData[arcCount * 4 + 3] = 0;

    arcPropData[arcCount * 4] = element.n;
    arcPropData[arcCount * 4 + 1] = element.grin ? 3.0 : 1.0;
    arcPropData[arcCount * 4 + 2] = element.grin || element.absorption || 0;
    arcPropData[arcCount * 4 + 3] = element.scattering || 0;

    arcCount++;
  };

  const pushSegment = (p1: Vector2, p2: Vector2, element: OpticElement) => {
    if (segmentCount >= MAX_SEGMENTS) return;

    segData[segmentCount * 4] = p1.x;
    segData[segmentCount * 4 + 1] = p1.y;
    segData[segmentCount * 4 + 2] = p2.x;
    segData[segmentCount * 4 + 3] = p2.y;

    const isReflective = element.type === 'mirror' || element.type === 'parabolicMirror';
    segmentProps[segmentCount * 4] = isReflective ? 1.0 : element.n;
    segmentProps[segmentCount * 4 + 1] = isReflective ? 2.0 : element.grin ? 3.0 : 1.0;
    segmentProps[segmentCount * 4 + 2] = element.grin || element.absorption || 0;
    segmentProps[segmentCount * 4 + 3] = element.scattering || 0;

    const groupIndex = Math.floor(segmentCount / GROUP_SIZE);
    groupBBox[groupIndex * 4] = Math.min(groupBBox[groupIndex * 4], p1.x, p2.x);
    groupBBox[groupIndex * 4 + 1] = Math.min(groupBBox[groupIndex * 4 + 1], p1.y, p2.y);
    groupBBox[groupIndex * 4 + 2] = Math.max(groupBBox[groupIndex * 4 + 2], p1.x, p2.x);
    groupBBox[groupIndex * 4 + 3] = Math.max(groupBBox[groupIndex * 4 + 3], p1.y, p2.y);

    segmentCount++;
  };

  const pushParabola = (element: OpticElement) => {
    if (parabolaCount >= MAX_PARABOLAS) return;

    const radius = element.curvatureRadius || 400;
    const halfWidth = (element.size || 200) / 2;
    const angle = (element.rotation || 0) * Math.PI / 180;

    parabolaData[parabolaCount * 4] = element.x;
    parabolaData[parabolaCount * 4 + 1] = element.y;
    parabolaData[parabolaCount * 4 + 2] = radius;
    parabolaData[parabolaCount * 4 + 3] = halfWidth;

    parabolaOrientationData[parabolaCount * 4] = Math.cos(angle);
    parabolaOrientationData[parabolaCount * 4 + 1] = Math.sin(angle);
    parabolaOrientationData[parabolaCount * 4 + 2] = 0;
    parabolaOrientationData[parabolaCount * 4 + 3] = 0;

    parabolaCount++;
  };

  for (const element of state.elements) {
    if (element.type === 'raindrop' && circleCount < MAX_CIRCLES) {
      circleData[circleCount * 3] = element.x;
      circleData[circleCount * 3 + 1] = element.y;
      circleData[circleCount * 3 + 2] = element.radius || 100;

      circlePropData[circleCount * 4] = element.n;
      circlePropData[circleCount * 4 + 1] = element.grin ? 3.0 : 1.0;
      circlePropData[circleCount * 4 + 2] = element.grin || element.absorption || 0;
      circlePropData[circleCount * 4 + 3] = element.scattering || 0;
      circleCount++;
      continue;
    }

    if (element.type === 'lens') {
      const radius = element.curvatureRadius || 200;
      const halfHeight = (element.height || 180) / 2;
      const thickness = element.thickness || 50;
      const safeHalfHeight = Math.min(halfHeight, radius * 0.999);
      const dx = Math.sqrt(radius * radius - safeHalfHeight * safeHalfHeight);
      const cosHalfAngle = dx / radius;

      if (element.lensType === 'convex') {
        pushArc(-dx, 0, radius, 1, 0, cosHalfAngle, 1.0, element);
        pushArc(dx, 0, radius, -1, 0, cosHalfAngle, 1.0, element);
      } else {
        pushArc(thickness / 2 + dx, 0, radius, -1, 0, cosHalfAngle, -1.0, element);
        pushArc(-thickness / 2 - dx, 0, radius, 1, 0, cosHalfAngle, -1.0, element);

        const angle = (element.rotation || 0) * Math.PI / 180;
        const topLeft = vadd(vec(element.x, element.y), vrot(vec(-thickness / 2, -halfHeight), angle));
        const topRight = vadd(vec(element.x, element.y), vrot(vec(thickness / 2, -halfHeight), angle));
        const bottomLeft = vadd(vec(element.x, element.y), vrot(vec(-thickness / 2, halfHeight), angle));
        const bottomRight = vadd(vec(element.x, element.y), vrot(vec(thickness / 2, halfHeight), angle));

        pushSegment(topLeft, topRight, element);
        pushSegment(bottomRight, bottomLeft, element);
      }

      continue;
    }

    if (element.type === 'parabolicMirror') {
      pushParabola(element);
      continue;
    }

    let edges: Array<{ p1: Vector2; p2: Vector2 }> = [];

    if (element.type === 'prism') edges = getPrismGeometry(element);
    else if (element.type === 'polygon') edges = getPolygonGeometry(element);
    else if (element.type === 'fiber') edges = getFiberGeometry(element);
    else if (element.type === 'mirror') {
      const angle = (element.rotation || 0) * Math.PI / 180;
      const length = element.length || 150;
      edges = [
        {
          p1: vadd(vec(element.x, element.y), vrot(vec(-length / 2, 0), angle)),
          p2: vadd(vec(element.x, element.y), vrot(vec(length / 2, 0), angle)),
        },
      ];
    }

    for (const edge of edges) {
      pushSegment(edge.p1, edge.p2, element);
    }
  }

  return {
    segData,
    segmentProps,
    groupBBox,
    arcData,
    arcLimitData,
    arcPropData,
    circleData,
    circlePropData,
    parabolaData,
    parabolaOrientationData,
    segmentCount,
    arcCount,
    circleCount,
    parabolaCount,
    groupCount: Math.ceil(segmentCount / GROUP_SIZE),
  };
}
