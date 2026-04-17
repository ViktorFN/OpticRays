import { Renderer } from './Renderer.js';
import { SceneBuffers } from './Buffers.js';
import { ShaderProgram } from './ShaderProgram.js';
import { TOTAL_RAYS } from '../physics/RayModel.js';

export class WebGLRenderer extends Renderer {
  constructor({ canvas, vertexSource, fragmentSource }) {
    super();
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!this.gl) {
      throw new Error('WebGL 2.0 не поддерживается');
    }

    this.program = new ShaderProgram(this.gl, vertexSource, fragmentSource);
    this.uniformLocs = this.#createUniformMap();
    this.buffers = new SceneBuffers(this.gl, this.uniformLocs);
    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);
  }

  resize(width, height, dpr) {
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  render(sceneData, frameState) {
    const { gl } = this;
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    this.program.use();
    gl.uniform2f(this.uniformLocs.res, frameState.viewport.width, frameState.viewport.height);
    gl.uniform2f(this.uniformLocs.lPos, frameState.light.position.x, frameState.light.position.y);
    gl.uniform2f(this.uniformLocs.lDir, Math.cos(frameState.light.angle), Math.sin(frameState.light.angle));
    gl.uniform1f(this.uniformLocs.bWidth, frameState.light.beamWidth);
    gl.uniform1f(this.uniformLocs.disp, frameState.environment.dispersion);
    gl.uniform1f(this.uniformLocs.envN, frameState.environment.refractiveIndex);
    gl.uniform1i(this.uniformLocs.cType, frameState.light.colorMode);
    gl.uniform1f(this.uniformLocs.bAlpha, this.#calculateBaseAlpha(frameState.light));

    this.buffers.upload(sceneData);
    gl.bindVertexArray(this.vao);
    gl.drawArraysInstanced(gl.LINE_STRIP, 0, 24, TOTAL_RAYS);
  }

  #calculateBaseAlpha(light) {
    const density = TOTAL_RAYS / Math.max(light.beamWidth, 1.0);
    return Math.max(1.5 / density, 0.0015) * light.intensity;
  }

  #createUniformMap() {
    return {
      res: this.program.getUniformLocation('u_resolution'),
      lPos: this.program.getUniformLocation('u_lightPos'),
      lDir: this.program.getUniformLocation('u_lightDir'),
      bWidth: this.program.getUniformLocation('u_beamWidth'),
      disp: this.program.getUniformLocation('u_dispersion'),
      envN: this.program.getUniformLocation('u_envN'),
      bAlpha: this.program.getUniformLocation('u_baseAlpha'),
      cType: this.program.getUniformLocation('u_colorType'),
      nSegs: this.program.getUniformLocation('u_numSegments'),
      segs: this.program.getUniformLocation('u_segments'),
      sProps: this.program.getUniformLocation('u_segProps'),
      nCircs: this.program.getUniformLocation('u_numCircles'),
      circs: this.program.getUniformLocation('u_circles'),
      cProps: this.program.getUniformLocation('u_circProps'),
    };
  }
}
