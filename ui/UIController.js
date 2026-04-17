import { Entity } from '../core/Entity.js';
import { CircleGeometry, LensGeometry, MirrorGeometry, PolygonGeometry, PrismGeometry } from '../core/Components/Geometry.js';
import { Material } from '../core/Components/Material.js';
import { Transform } from '../core/Components/Transform.js';
import { radians, vec } from '../utils/math.js';

export class UIController {
  constructor({ store, overlayCanvas, overlayContext, optics, inspector, dom }) {
    this.store = store;
    this.overlayCanvas = overlayCanvas;
    this.ctx = overlayContext;
    this.optics = optics;
    this.inspector = inspector;
    this.dom = dom;
  }

  bind() {
    this.dom.resetButton.addEventListener('click', () => this.resetScene());
    this.dom.deleteButton.addEventListener('click', () => this.store.removeSelected());
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        this.store.removeSelected();
      }
    });

    this.dom.addButtons.prism.addEventListener('click', () => this.addPrism());
    this.dom.addButtons.raindrop.addEventListener('click', () => this.addRaindrop());
    this.dom.addButtons.convexLens.addEventListener('click', () => this.addLens('convex'));
    this.dom.addButtons.concaveLens.addEventListener('click', () => this.addLens('concave'));
    this.dom.addButtons.mirror.addEventListener('click', () => this.addMirror());
    this.dom.addButtons.polygon.addEventListener('click', () => this.addPolygon());

    this.dom.colorButtons.forEach((button, colorMode) => {
      button.addEventListener('click', () => this.setLightColor(colorMode));
    });

    this.dom.lightAngle.addEventListener('input', () => this.updateLightControls());
    this.dom.beamWidth.addEventListener('input', () => this.updateLightControls());
    this.dom.intensity.addEventListener('input', () => this.updateLightControls());
    this.dom.dispersion.addEventListener('input', () => this.updateEnvironmentControls());
    this.dom.environmentRefractiveIndex.addEventListener('input', () => this.updateEnvironmentControls());
  }

  syncControls() {
    this.dom.angleValue.textContent = `${this.store.light.angleDegrees}°`;
    this.dom.beamValue.textContent = String(this.store.light.beamWidth);
    this.dom.intensityValue.textContent = `x${this.store.light.intensity.toFixed(1)}`;
    this.dom.dispersionValue.textContent = `x${(this.store.environment.dispersion * 50).toFixed(1)}`;
    this.dom.environmentValue.textContent = this.store.environment.refractiveIndex.toFixed(2);
    this.dom.lightAngle.value = String(this.store.light.angleDegrees);
    this.dom.beamWidth.value = String(this.store.light.beamWidth);
    this.dom.intensity.value = String(Math.round(this.store.light.intensity * 100));
    this.dom.dispersion.value = String(Math.round(this.store.environment.dispersion * 500));
    this.dom.environmentRefractiveIndex.value = String(Math.round(this.store.environment.refractiveIndex * 100));

    this.dom.colorButtons.forEach((button, index) => {
      button.classList.toggle('bg-white/20', index === this.store.light.colorMode);
      button.classList.toggle('text-white', index === this.store.light.colorMode);
    });
  }

  resetScene() {
    this.store.scene.clear();
    this.store.selection = null;
    this.store.light = {
      ...this.store.light,
      position: vec(150, this.store.viewport.height * 0.45),
      angle: radians(0),
      angleDegrees: 0,
      beamWidth: 25,
      intensity: 1.0,
      colorMode: 0,
    };
    this.store.environment = {
      dispersion: 0.06,
      refractiveIndex: 1.0,
    };
    this.addPrism();
    const prism = this.store.getSelectedEntity();
    prism.transform.x = this.store.viewport.width * 0.5 + 50;
    prism.transform.y = this.store.viewport.height * 0.5;
    prism.transform.rotation = 15;
    this.store.notify();
  }

  updateLightControls() {
    const angleDegrees = Number(this.dom.lightAngle.value);
    this.store.updateLight({
      angleDegrees,
      angle: radians(angleDegrees),
      beamWidth: Number(this.dom.beamWidth.value),
      intensity: Number(this.dom.intensity.value) / 100,
    });
  }

  updateEnvironmentControls() {
    this.store.updateEnvironment({
      dispersion: Number(this.dom.dispersion.value) / 500,
      refractiveIndex: Number(this.dom.environmentRefractiveIndex.value) / 100,
    });
  }

  setLightColor(colorMode) {
    this.store.updateLight({ colorMode });
  }

  addPrism() {
    return this.store.addEntity(new Entity({
      type: 'prism',
      geometry: new PrismGeometry(140),
      material: new Material({ refractiveIndex: 1.52 }),
      transform: new Transform(this.store.viewport.width / 2, this.store.viewport.height / 2, 0),
    }));
  }

  addLens(lensType) {
    return this.store.addEntity(new Entity({
      type: 'lens',
      geometry: new LensGeometry({ lensType, curvatureRadius: 200, height: 180, thickness: 50 }),
      material: new Material({ refractiveIndex: 1.52 }),
      transform: new Transform(this.store.viewport.width / 2, this.store.viewport.height / 2, 0),
    }));
  }

  addRaindrop() {
    return this.store.addEntity(new Entity({
      type: 'raindrop',
      geometry: new CircleGeometry(100),
      material: new Material({ refractiveIndex: 1.33 }),
      transform: new Transform(this.store.viewport.width / 2, this.store.viewport.height / 2, 0),
    }));
  }

  addMirror() {
    return this.store.addEntity(new Entity({
      type: 'mirror',
      geometry: new MirrorGeometry(150),
      material: new Material({ refractiveIndex: 1, opticalType: 'mirror' }),
      transform: new Transform(this.store.viewport.width / 2, this.store.viewport.height / 2, 45),
    }));
  }

  addPolygon() {
    return this.store.addEntity(new Entity({
      type: 'polygon',
      geometry: new PolygonGeometry([
        vec(-60, -60),
        vec(60, -60),
        vec(60, 60),
        vec(-60, 60),
      ]),
      material: new Material({ refractiveIndex: 1.52 }),
      transform: new Transform(this.store.viewport.width / 2, this.store.viewport.height / 2, 0),
    }));
  }

  draw() {
    const { width, height } = this.store.viewport;
    this.ctx.clearRect(0, 0, width, height);
    this.#drawGrid(width, height);

    this.store.scene.entities.forEach((entity) => {
      const selected = entity.id === this.store.selection;
      this.#drawEntity(entity, selected);
    });

    this.#drawLightSource();
    this.inspector.render();
    this.syncControls();
  }

  #drawGrid(width, height) {
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let x = 0; x < width; x += 40) {
      for (let y = 0; y < height; y += 40) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  #drawEntity(entity, selected) {
    if (entity.geometry.kind === 'circle') {
      this.#drawCircle(entity, selected);
      return;
    }

    if (entity.geometry.kind === 'mirror') {
      this.#drawMirror(entity, selected);
      return;
    }

    const edges = this.optics.getEntityEdges(entity);
    if (!edges.length) {
      return;
    }

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(edges[0].p1.x, edges[0].p1.y);
    edges.forEach((edge) => this.ctx.lineTo(edge.p2.x, edge.p2.y));
    this.ctx.fillStyle = this.#fillColor(entity.geometry.kind);
    this.ctx.fill();
    this.#applyGlassStyle(selected, this.#strokeColor(entity.geometry.kind));
    this.ctx.stroke();

    if (selected && entity.geometry.kind === 'polygon') {
      this.ctx.shadowBlur = 0;
      edges.forEach((edge, index) => {
        const hovered = this.store.interaction.hoveredVertex?.entityId === entity.id && this.store.interaction.hoveredVertex?.vertexIndex === index;
        this.ctx.fillStyle = hovered ? '#fff' : '#22c55e';
        this.ctx.beginPath();
        this.ctx.arc(edge.p1.x, edge.p1.y, hovered ? 6 : 4, 0, Math.PI * 2);
        this.ctx.fill();
      });
    }

    this.ctx.restore();
  }

  #drawCircle(entity, selected) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(entity.transform.x, entity.transform.y, entity.geometry.radius, 0, Math.PI * 2);
    this.ctx.fillStyle = 'rgba(2,132,199,0.05)';
    this.ctx.fill();
    this.#applyGlassStyle(selected, '#0ea5e9');
    this.ctx.stroke();
    this.ctx.restore();
  }

  #drawMirror(entity, selected) {
    this.ctx.save();
    this.ctx.translate(entity.transform.x, entity.transform.y);
    this.ctx.rotate(radians(entity.transform.rotation));
    this.ctx.fillStyle = 'rgba(148,163,184,0.3)';
    this.ctx.fillRect(-entity.geometry.length / 2, -3, entity.geometry.length, 6);
    this.ctx.beginPath();
    this.ctx.moveTo(-entity.geometry.length / 2, 0);
    this.ctx.lineTo(entity.geometry.length / 2, 0);
    this.#applyGlassStyle(selected, '#fff');
    this.ctx.stroke();
    this.ctx.restore();
  }

  #drawLightSource() {
    const { x, y } = this.store.light.position;
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 40, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#fff';
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  #applyGlassStyle(selected, mainColor) {
    this.ctx.shadowBlur = selected ? 15 : 0;
    this.ctx.shadowColor = mainColor;
    this.ctx.strokeStyle = selected ? '#fff' : mainColor;
    this.ctx.lineWidth = selected ? 1.5 : 1;
  }

  #fillColor(kind) {
    return {
      prism: 'rgba(139, 92, 246, 0.05)',
      polygon: 'rgba(34, 197, 94, 0.05)',
      lens: 'rgba(34, 211, 238, 0.05)',
    }[kind] ?? 'rgba(255,255,255,0.04)';
  }

  #strokeColor(kind) {
    return {
      prism: '#8b5cf6',
      polygon: '#22c55e',
      lens: '#06b6d4',
    }[kind] ?? '#ffffff';
  }
}
