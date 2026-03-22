export class Scene {
  constructor() {
    this.entities = [];
  }

  add(entity) {
    this.entities.push(entity);
    return entity;
  }

  remove(id) {
    const index = this.entities.findIndex((entity) => entity.id === id);
    if (index === -1) {
      return null;
    }

    const [removed] = this.entities.splice(index, 1);
    return removed;
  }

  clear() {
    this.entities = [];
  }

  getById(id) {
    return this.entities.find((entity) => entity.id === id) ?? null;
  }
}
