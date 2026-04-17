export class Inspector {
  constructor({ store, container, panel }) {
    this.store = store;
    this.container = container;
    this.panel = panel;
  }

  render() {
    const entity = this.store.getSelectedEntity();
    if (!entity) {
      this.hide();
      return;
    }

    this.show();
    this.container.innerHTML = '';
    const controls = this.#getControls(entity);
    for (const control of controls) {
      this.container.append(this.#createControl(entity, control));
    }
  }

  hide() {
    this.panel.classList.remove('translate-x-0', 'opacity-100', 'pointer-events-auto');
    this.panel.classList.add('translate-x-10', 'opacity-0', 'pointer-events-none');
  }

  show() {
    this.panel.classList.remove('translate-x-10', 'opacity-0', 'pointer-events-none');
    this.panel.classList.add('translate-x-0', 'opacity-100', 'pointer-events-auto');
  }

  #createControl(entity, config) {
    const wrapper = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'flex justify-between items-end mb-2';

    const label = document.createElement('span');
    label.className = 'text-xs text-gray-300';
    label.textContent = config.label;

    const value = document.createElement('span');
    value.className = 'badge';
    value.textContent = this.#formatValue(entity, config);

    header.append(label, value);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(config.min);
    input.max = String(config.max);
    input.value = String(config.read(entity) * config.scale);
    input.addEventListener('input', () => {
      const actualValue = Number(input.value) / config.scale;
      this.store.updateEntity(entity.id, (target) => config.write(target, actualValue));
      value.textContent = this.#formatValue(entity, config, actualValue);
    });

    wrapper.append(header, input);
    return wrapper;
  }

  #formatValue(entity, config, explicitValue) {
    const currentValue = explicitValue ?? config.read(entity);
    return config.scale === 100 ? currentValue.toFixed(2) : Math.round(currentValue * config.scale).toString();
  }

  #getControls(entity) {
    const t = entity.transform;
    const g = entity.geometry;
    const m = entity.material;
    const controls = {
      circle: [
        { label: 'Радиус', min: 20, max: 200, scale: 1, read: () => g.radius, write: (_, value) => { g.radius = value; } },
        { label: 'Индекс среды (n)', min: 100, max: 250, scale: 100, read: () => m.refractiveIndex, write: (_, value) => { m.refractiveIndex = value; } },
      ],
      prism: [
        { label: 'Размер', min: 50, max: 400, scale: 1, read: () => g.size, write: (_, value) => { g.size = value; } },
        { label: 'Индекс среды (n)', min: 100, max: 250, scale: 100, read: () => m.refractiveIndex, write: (_, value) => { m.refractiveIndex = value; } },
        { label: 'Поворот', min: 0, max: 360, scale: 1, read: () => t.rotation, write: (_, value) => { t.rotation = value; } },
      ],
      lens: [
        { label: 'Высота', min: 50, max: 400, scale: 1, read: () => g.height, write: (_, value) => { g.height = value; } },
        { label: 'Кривизна', min: 50, max: 600, scale: 1, read: () => g.curvatureRadius, write: (_, value) => { g.curvatureRadius = value; } },
        { label: 'Толщина', min: 10, max: 150, scale: 1, read: () => g.thickness, write: (_, value) => { g.thickness = value; } },
        { label: 'Индекс (n)', min: 100, max: 250, scale: 100, read: () => m.refractiveIndex, write: (_, value) => { m.refractiveIndex = value; } },
        { label: 'Поворот', min: 0, max: 360, scale: 1, read: () => t.rotation, write: (_, value) => { t.rotation = value; } },
      ],
      mirror: [
        { label: 'Длина', min: 50, max: 400, scale: 1, read: () => g.length, write: (_, value) => { g.length = value; } },
        { label: 'Поворот', min: 0, max: 360, scale: 1, read: () => t.rotation, write: (_, value) => { t.rotation = value; } },
      ],
      polygon: [
        { label: 'Индекс среды (n)', min: 100, max: 250, scale: 100, read: () => m.refractiveIndex, write: (_, value) => { m.refractiveIndex = value; } },
        { label: 'Поворот', min: 0, max: 360, scale: 1, read: () => t.rotation, write: (_, value) => { t.rotation = value; } },
      ],
    };

    return controls[g.kind] ?? [];
  }
}
