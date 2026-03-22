export class SceneBuffers {
  constructor(gl, uniformLocs) {
    this.gl = gl;
    this.uniformLocs = uniformLocs;
  }

  upload(data) {
    this.gl.uniform1i(this.uniformLocs.nSegs, data.segmentCount);
    if (data.segmentCount > 0) {
      this.gl.uniform4fv(this.uniformLocs.segs, data.segments);
      this.gl.uniform2fv(this.uniformLocs.sProps, data.segmentProps);
    }

    this.gl.uniform1i(this.uniformLocs.nCircs, data.circleCount);
    if (data.circleCount > 0) {
      this.gl.uniform3fv(this.uniformLocs.circs, data.circles);
      this.gl.uniform2fv(this.uniformLocs.cProps, data.circleProps);
    }
  }
}
