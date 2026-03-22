export class Geometry {
  constructor(kind, params = {}) {
    this.kind = kind;
    Object.assign(this, params);
  }
}

export class PrismGeometry extends Geometry {
  constructor(size = 140) {
    super('prism', { size });
  }
}

export class LensGeometry extends Geometry {
  constructor({ lensType = 'convex', curvatureRadius = 200, height = 180, thickness = 50, steps = 128 } = {}) {
    super('lens', { lensType, curvatureRadius, height, thickness, steps });
  }
}

export class CircleGeometry extends Geometry {
  constructor(radius = 100) {
    super('circle', { radius });
  }
}

export class MirrorGeometry extends Geometry {
  constructor(length = 150) {
    super('mirror', { length });
  }
}

export class PolygonGeometry extends Geometry {
  constructor(vertices = []) {
    super('polygon', {
      vertices: vertices.map((vertex) => ({ x: vertex.x, y: vertex.y })),
    });
  }
}
