export function vec(x = 0, y = 0) {
  return { x, y };
}

export function add(a, b) {
  return vec(a.x + b.x, a.y + b.y);
}

export function subtract(a, b) {
  return vec(a.x - b.x, a.y - b.y);
}

export function rotate(point, angleRadians) {
  const c = Math.cos(angleRadians);
  const s = Math.sin(angleRadians);
  return vec(point.x * c - point.y * s, point.x * s + point.y * c);
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function distToSegment(point, start, end) {
  const l2 = (start.x - end.x) ** 2 + (start.y - end.y) ** 2;
  if (l2 === 0) {
    return distance(point, start);
  }

  let t = ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / l2;
  t = Math.max(0, Math.min(1, t));

  return Math.hypot(
    point.x - (start.x + t * (end.x - start.x)),
    point.y - (start.y + t * (end.y - start.y)),
  );
}

export function radians(degrees) {
  return degrees * Math.PI / 180;
}
