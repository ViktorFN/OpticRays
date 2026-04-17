export const MAX_SEGMENTS = 1000;
export const MAX_CIRCLES = 10;
export const TOTAL_RAYS = 60000;

export class GPUSceneData {
  constructor() {
    this.segments = new Float32Array(MAX_SEGMENTS * 4);
    this.segmentProps = new Float32Array(MAX_SEGMENTS * 2);
    this.circles = new Float32Array(MAX_CIRCLES * 3);
    this.circleProps = new Float32Array(MAX_CIRCLES * 2);
    this.segmentCount = 0;
    this.circleCount = 0;
  }
}
