import { distToSegment, distance, rotate, radians, subtract, vec } from '../utils/math.js';

export class InputController {
  constructor({ store, scene, canvas, optics, inspector }) {
    this.store = store;
    this.scene = scene;
    this.canvas = canvas;
    this.optics = optics;
    this.inspector = inspector;
  }

  bind() {
    this.canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
    this.canvas.addEventListener('mousedown', (event) => this.onMouseDown(event));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    this.canvas.addEventListener('dblclick', (event) => this.onDoubleClick(event));
  }

  onMouseMove(event) {
    const point = vec(event.clientX, event.clientY);
    const interaction = this.store.interaction;

    if (interaction.lightDragging) {
      this.store.updateLight({ position: point });
      return;
    }

    if (interaction.draggingVertex) {
      const entity = this.scene.getById(interaction.draggingVertex.entityId);
      if (!entity) {
        return;
      }
      const local = rotate(subtract(point, entity.transform), -radians(entity.transform.rotation || 0));
      this.store.updateEntity(entity.id, (target) => {
        target.geometry.vertices[interaction.draggingVertex.vertexIndex] = local;
      });
      return;
    }

    if (interaction.draggingEntityId) {
      this.store.updateEntity(interaction.draggingEntityId, (entity) => {
        entity.transform.x = point.x - interaction.dragOffset.x;
        entity.transform.y = point.y - interaction.dragOffset.y;
      });
      return;
    }

    const hoveredVertex = this.#checkVertexHover(point.x, point.y);
    this.store.setInteraction({ hoveredVertex });
    this.canvas.style.cursor = hoveredVertex
      ? 'crosshair'
      : (this.#getEntityAt(point.x, point.y) || distance(point, this.store.light.position) < 40)
        ? 'move'
        : 'default';
  }

  onMouseDown(event) {
    const point = vec(event.clientX, event.clientY);

    if (distance(point, this.store.light.position) < 40) {
      this.store.setInteraction({ lightDragging: true });
      return;
    }

    const hoveredVertex = this.#checkVertexHover(point.x, point.y);
    if (hoveredVertex) {
      this.store.setInteraction({ draggingVertex: hoveredVertex, hoveredVertex });
      return;
    }

    const entity = this.#getEntityAt(point.x, point.y);
    if (!entity) {
      this.store.setSelection(null);
      this.inspector.hide();
      return;
    }

    this.store.selection = entity.id;
    this.store.setInteraction({
      draggingEntityId: entity.id,
      dragOffset: vec(point.x - entity.transform.x, point.y - entity.transform.y),
    });
    this.store.notify();
  }

  onMouseUp() {
    this.store.resetInteraction();
  }

  onWheel(event) {
    const entity = this.#getEntityAt(event.clientX, event.clientY);
    if (!entity || entity.geometry.kind === 'circle') {
      return;
    }

    event.preventDefault();
    this.store.updateEntity(entity.id, (target) => {
      target.transform.rotation = (target.transform.rotation + (event.deltaY > 0 ? 5 : -5) + 360) % 360;
    });
  }

  onDoubleClick(event) {
    const entity = this.store.getSelectedEntity();
    if (!entity || entity.geometry.kind !== 'polygon') {
      return;
    }

    const edges = this.optics.getEntityEdges(entity);
    for (let i = 0; i < edges.length; i += 1) {
      if (distance(vec(event.clientX, event.clientY), edges[i].p1) < 15 && entity.geometry.vertices.length > 3) {
        this.store.updateEntity(entity.id, (target) => {
          target.geometry.vertices.splice(i, 1);
        });
        this.#checkVertexHover(event.clientX, event.clientY);
        return;
      }
    }

    const mouse = vec(event.clientX, event.clientY);
    for (let i = 0; i < edges.length; i += 1) {
      if (distToSegment(mouse, edges[i].p1, edges[i].p2) < 10) {
        const local = rotate(subtract(mouse, entity.transform), -radians(entity.transform.rotation || 0));
        this.store.updateEntity(entity.id, (target) => {
          target.geometry.vertices.splice(i + 1, 0, local);
        });
        return;
      }
    }
  }

  #checkVertexHover(x, y) {
    const entity = this.store.getSelectedEntity();
    if (!entity || entity.geometry.kind !== 'polygon') {
      return null;
    }

    const angle = radians(entity.transform.rotation || 0);
    for (let i = 0; i < entity.geometry.vertices.length; i += 1) {
      const point = {
        x: entity.transform.x + rotate(entity.geometry.vertices[i], angle).x,
        y: entity.transform.y + rotate(entity.geometry.vertices[i], angle).y,
      };
      if (distance(vec(x, y), point) < 10) {
        return { entityId: entity.id, vertexIndex: i };
      }
    }

    return null;
  }

  #getEntityAt(x, y) {
    for (let i = this.scene.entities.length - 1; i >= 0; i -= 1) {
      const entity = this.scene.entities[i];
      if (entity.geometry.kind === 'polygon') {
        if (this.#isInsidePolygon(entity, x, y)) {
          return entity;
        }
        continue;
      }

      const d = Math.hypot(x - entity.transform.x, y - entity.transform.y);
      let maxDist = 40;
      if (entity.geometry.kind === 'circle') maxDist = entity.geometry.radius;
      if (entity.geometry.kind === 'lens') maxDist = entity.geometry.height / 2;
      if (entity.geometry.kind === 'prism') maxDist = entity.geometry.size / 1.5;
      if (entity.geometry.kind === 'mirror') maxDist = entity.geometry.length / 2;
      if (d < maxDist) {
        return entity;
      }
    }

    return null;
  }

  #isInsidePolygon(entity, x, y) {
    const angle = radians(entity.transform.rotation || 0);
    const project = (point) => ({
      x: entity.transform.x + rotate(point, angle).x,
      y: entity.transform.y + rotate(point, angle).y,
    });

    let inside = false;
    for (let j = 0, k = entity.geometry.vertices.length - 1; j < entity.geometry.vertices.length; k = j++) {
      const pj = project(entity.geometry.vertices[j]);
      const pk = project(entity.geometry.vertices[k]);
      if (((pj.y > y) !== (pk.y > y)) && (x < ((pk.x - pj.x) * (y - pj.y)) / (pk.y - pj.y) + pj.x)) {
        inside = !inside;
      }
    }

    return inside;
  }
}
