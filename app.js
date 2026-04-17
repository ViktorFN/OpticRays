import { OpticsEngine } from './physics/OpticsEngine.js';
import { WebGLRenderer } from './render/WebGLRenderer.js';
import { Store } from './state/Store.js';
import { Inspector } from './ui/Inspector.js';
import { InputController } from './ui/InputController.js';
import { UIController } from './ui/UIController.js';

const overlayCanvas = document.getElementById('uicanvas');
const glCanvas = document.getElementById('glcanvas');
const overlayContext = overlayCanvas.getContext('2d');

const vertexSource = document.getElementById('vertex-shader').textContent;
const fragmentSource = document.getElementById('fragment-shader').textContent;

const store = new Store();
const optics = new OpticsEngine();
const renderer = new WebGLRenderer({ canvas: glCanvas, vertexSource, fragmentSource });

const dom = {
  resetButton: document.getElementById('resetSceneBtn'),
  deleteButton: document.getElementById('deleteSelectedBtn'),
  lightAngle: document.getElementById('lightAngle'),
  beamWidth: document.getElementById('beamWidth'),
  intensity: document.getElementById('uiIntensity'),
  dispersion: document.getElementById('uiDispersion'),
  environmentRefractiveIndex: document.getElementById('uiEnvN'),
  angleValue: document.getElementById('angleValue'),
  beamValue: document.getElementById('beamValue'),
  intensityValue: document.getElementById('intensityVal'),
  dispersionValue: document.getElementById('dispValue'),
  environmentValue: document.getElementById('envNValue'),
  colorButtons: [0, 1, 2, 3].map((index) => document.getElementById(`btn-color-${index}`)),
  addButtons: {
    prism: document.getElementById('addPrismBtn'),
    raindrop: document.getElementById('addRaindropBtn'),
    convexLens: document.getElementById('addConvexLensBtn'),
    concaveLens: document.getElementById('addConcaveLensBtn'),
    mirror: document.getElementById('addMirrorBtn'),
    polygon: document.getElementById('addPolygonBtn'),
  },
};

const inspector = new Inspector({
  store,
  container: document.getElementById('elementControls'),
  panel: document.getElementById('elementPanel'),
});

const uiController = new UIController({
  store,
  overlayCanvas,
  overlayContext,
  optics,
  inspector,
  dom,
});

const inputController = new InputController({
  store,
  scene: store.scene,
  canvas: overlayCanvas,
  optics,
  inspector,
});

let frameRequested = false;
function requestFrame() {
  if (frameRequested) {
    return;
  }

  frameRequested = true;
  requestAnimationFrame(() => {
    frameRequested = false;
    const gpuData = optics.buildGPUData(store.scene);
    renderer.render(gpuData, store);
    uiController.draw();
  });
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  overlayCanvas.width = width * dpr;
  overlayCanvas.height = height * dpr;
  overlayCanvas.style.width = `${width}px`;
  overlayCanvas.style.height = `${height}px`;
  overlayContext.setTransform(1, 0, 0, 1, 0, 0);
  overlayContext.scale(dpr, dpr);

  renderer.resize(width, height, dpr);
  store.setViewport(width, height, dpr);
}

store.subscribe(() => requestFrame());
window.addEventListener('resize', resize);
uiController.bind();
inputController.bind();
resize();
uiController.resetScene();
