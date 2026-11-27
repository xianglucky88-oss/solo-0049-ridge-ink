import { cell } from './mesh.mjs'

const epsilon = 1e-10

export function incident(surface, x, y) {
  const px = (x - surface.originX) / surface.unit, py = (y - surface.originY) / surface.unit
  const candidates = []
  for (let row = Math.max(0, Math.ceil(py - 1 - epsilon)); row <= Math.min(surface.height - 2, Math.floor(py + epsilon)); row++) {
    for (let column = Math.max(0, Math.ceil(px - 1 - epsilon)); column <= Math.min(surface.width - 2, Math.floor(px + epsilon)); column++) {
      const u = Math.max(0, Math.min(1, px - column)), v = Math.max(0, Math.min(1, py - row))
      const [first, second] = cell(surface, column, row)
      if (v <= u + epsilon && first.every(point => point.z !== null)) candidates.push({ triangle: first, weights: [1 - u, Math.max(0, u - v), Math.min(u,v)] })
      if (v >= u - epsilon && second.every(point => point.z !== null)) candidates.push({ triangle: second, weights: [1 - v, Math.min(u,v), Math.max(0, v - u)] })
    }
  }
  return candidates[0]
}

export function triangleAt(surface, x, y) {
  if (x < surface.originX || y < surface.originY || x > surface.right || y > surface.top) return null
  return incident(surface, x, y)
}
