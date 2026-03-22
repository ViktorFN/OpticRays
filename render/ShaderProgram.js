export class ShaderProgram {
  constructor(gl, vertexSource, fragmentSource) {
    this.gl = gl;
    this.program = this.#createProgram(vertexSource, fragmentSource);
  }

  use() {
    this.gl.useProgram(this.program);
  }

  getUniformLocation(name) {
    return this.gl.getUniformLocation(this.program, name);
  }

  #createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source.trim());
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const message = this.gl.getShaderInfoLog(shader);
      this.gl.deleteShader(shader);
      throw new Error(message ?? 'Shader compile error');
    }

    return shader;
  }

  #createProgram(vertexSource, fragmentSource) {
    const vertexShader = this.#createShader(this.gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.#createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
    const program = this.gl.createProgram();
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const message = this.gl.getProgramInfoLog(program);
      this.gl.deleteProgram(program);
      throw new Error(message ?? 'Program link error');
    }

    return program;
  }
}
