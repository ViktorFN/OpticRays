import { GPUSceneData, MAX_SEGMENTS, MAX_CIRCLES } from './RayModel.js';
import { add, radians, rotate, vec } from '../utils/math.js';

export class OpticsEngine {
  buildGPUData(scene) {
    const gpuData = new GPUSceneData();

    for (const entity of scene.entities) {
      if (entity.geometry.kind === 'circle') {
        this.#appendCircle(entity, gpuData);
        continue;
      }

      const edges = this.#getEdges(entity);
      for (const edge of edges) {
        if (gpuData.segmentCount >= MAX_SEGMENTS) {
          break;
        }

        const index = gpuData.segmentCount;
        gpuData.segments.set([edge.p1.x, edge.p1.y, edge.p2.x, edge.p2.y], index * 4);
        gpuData.segmentProps.set([
          entity.material.opticalType === 'mirror' ? 1.0 : entity.material.refractiveIndex,
          entity.material.opticalType === 'mirror' ? 2.0 : 1.0,
        ], index * 2);
        gpuData.segmentCount += 1;
      }
    }

    return gpuData;
  }

  getEntityEdges(entity) {
    if (entity.geometry.kind === 'circle') {
      return [];
    }

    return this.#getEdges(entity);
  }

  getEntityOutline(entity) {
    if (entity.geometry.kind === 'circle') {
      const { x, y } = entity.transform;
      return [vec(x, y)];
    }

    const edges = this.#getEdges(entity);
    return edges.map((edge) => edge.p1);
  }

  #appendCircle(entity, gpuData) {
    if (gpuData.circleCount >= MAX_CIRCLES) {
      return;
    }

    const index = gpuData.circleCount;
    gpuData.circles.set([
      entity.transform.x,
      entity.transform.y,
      entity.geometry.radius,
    ], index * 3);
    gpuData.circleProps.set([
      entity.material.refractiveIndex,
      1.0,
    ], index * 2);
    gpuData.circleCount += 1;
  }

  #getEdges(entity) {
    switch (entity.geometry.kind) {
      case 'prism':
        return this.#getPrismEdges(entity);
      case 'polygon':
        return this.#getPolygonEdges(entity);
      case 'lens':
        return this.#getLensEdges(entity);
      case 'mirror':
        return this.#getMirrorEdges(entity);
      default:
        return [];
    }
  }

  #getPrismEdges(entity) {
    const angle = radians(entity.transform.rotation);
    const h = entity.geometry.size * Math.sqrt(3) / 2;
    const vertices = [
      vec(0, -h * 2 / 3),
      vec(entity.geometry.size / 2, h / 3),
      vec(-entity.geometry.size / 2, h / 3),
    ].map((point) => add(vec(entity.transform.x, entity.transform.y), rotate(point, angle)));

    return [
      { p1: vertices[0], p2: vertices[1] },
      { p1: vertices[1], p2: vertices[2] },
      { p1: vertices[2], p2: vertices[0] },
    ];
  }

  #getPolygonEdges(entity) {
    const angle = radians(entity.transform.rotation);
    const vertices = entity.geometry.vertices.map((point) => add(vec(entity.transform.x, entity.transform.y), rotate(point, angle)));
    return vertices.map((point, index) => ({
      p1: point,
      p2: vertices[(index + 1) % vertices.length],
    }));
  }

  #getLensEdges(entity) {
    const { curvatureRadius: R, thickness, lensType, steps } = entity.geometry;
    let H = entity.geometry.height / 2;
    let T = thickness;
    const points = [];

    if (lensType === 'convex') {
      const d = R - Math.sqrt(Math.max(0, R * R - H * H));
      if (T < 2 * d) {
        T = Math.min(T, 2 * R);
        H = Math.sqrt(Math.max(0, R * R - (R - T / 2) ** 2));
      }
      const cxRight = T / 2 - R;
      const cxLeft = -T / 2 + R;
      for (let i = 0; i <= steps; i += 1) {
        const y = -H + (2 * H) * (i / steps);
        points.push(vec(cxRight + Math.sqrt(R * R - y * y), y));
      }
      for (let i = 0; i <= steps; i += 1) {
        const y = H - (2 * H) * (i / steps);
        points.push(vec(cxLeft - Math.sqrt(R * R - y * y), y));
      }
    } else {
      const cxRight = T / 2 + R;
      const cxLeft = -T / 2 - R;
      for (let i = 0; i <= steps; i += 1) {
        const y = -H + (2 * H) * (i / steps);
        points.push(vec(cxRight - Math.sqrt(R * R - y * y), y));
      }
      for (let i = 0; i <= steps; i += 1) {
        const y = H - (2 * H) * (i / steps);
        points.push(vec(cxLeft + Math.sqrt(R * R - y * y), y));
      }
    }

    const angle = radians(entity.transform.rotation);
    const worldPoints = points.map((point) => add(vec(entity.transform.x, entity.transform.y), rotate(point, angle)));

    return worldPoints
      .map((point, index) => ({
        p1: point,
        p2: worldPoints[(index + 1) % worldPoints.length],
      }))
      .filter((edge) => Math.hypot(edge.p1.x - edge.p2.x, edge.p1.y - edge.p2.y) > 0.1);
  }

  #getMirrorEdges(entity) {
    const angle = radians(entity.transform.rotation);
    return [{
      p1: add(vec(entity.transform.x, entity.transform.y), rotate(vec(-entity.geometry.length / 2, 0), angle)),
      p2: add(vec(entity.transform.x, entity.transform.y), rotate(vec(entity.geometry.length / 2, 0), angle)),
    }];
  }
}
