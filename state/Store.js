import { Scene } from '../core/Scene.js';
import { radians, vec } from '../utils/math.js';

export class Store {
  constructor() {
    this.scene = new Scene();
    this.selection = null;
    this.light = {
      position: vec(150, 350),
      angle: radians(0),
      angleDegrees: 0,
      beamWidth: 25,
      intensity: 1.0,
      colorMode: 0,
    };
    this.environment = {
      dispersion: 0.06,
      refractiveIndex: 1.0,
    };
    this.viewport = {
      width: 0,
      height: 0,
      dpr: 1,
    };
    this.interaction = {
      lightDragging: false,
      draggingEntityId: null,
      dragOffset: vec(0, 0),
      draggingVertex: null,
      hoveredVertex: null,
    };
    this.listeners = new Set();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this);
    }
  }

  setViewport(width, height, dpr) {
    this.viewport = { width, height, dpr };
    if (this.light.position.y === 350 || this.light.position.y === 0) {
      this.light.position = vec(this.light.position.x, height / 2);
    }
    this.notify();
  }

  setSelection(id) {
    this.selection = id;
    this.notify();
  }

  getSelectedEntity() {
    return this.selection ? this.scene.getById(this.selection) : null;
  }

  addEntity(entity) {
    this.scene.add(entity);
    this.selection = entity.id;
    this.notify();
    return entity;
  }

  removeSelected() {
    if (!this.selection) {
      return null;
    }

    const removed = this.scene.remove(this.selection);
    this.selection = null;
    this.notify();
    return removed;
  }

  updateLight(patch) {
    this.light = { ...this.light, ...patch };
    this.notify();
  }

  updateEnvironment(patch) {
    this.environment = { ...this.environment, ...patch };
    this.notify();
  }

  updateEntity(entityId, updater) {
    const entity = this.scene.getById(entityId);
    if (!entity) {
      return;
    }

    updater(entity);
    this.notify();
  }

  setInteraction(patch) {
    this.interaction = { ...this.interaction, ...patch };
    this.notify();
  }

  resetInteraction() {
    this.interaction = {
      lightDragging: false,
      draggingEntityId: null,
      dragOffset: vec(0, 0),
      draggingVertex: null,
      hoveredVertex: null,
    };
    this.notify();
  }
}
