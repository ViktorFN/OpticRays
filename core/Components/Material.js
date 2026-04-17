export class Material {
  constructor({ refractiveIndex = 1, opticalType = 'refractive' } = {}) {
    this.refractiveIndex = refractiveIndex;
    this.opticalType = opticalType;
  }
}
