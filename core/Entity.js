import { Transform } from './Components/Transform.js';

let entityCounter = 0;

export class Entity {
  constructor({ id, type, transform = new Transform(), geometry, material }) {
    this.id = id ?? `${type}-${++entityCounter}`;
    this.type = type;
    this.transform = transform;
    this.geometry = geometry;
    this.material = material;
  }
}
