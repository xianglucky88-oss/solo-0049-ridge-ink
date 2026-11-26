import { crossing } from './crossing.mjs'

export function segments(mesh, height) {
  const unique = new Map()
  for (const [a, b, c] of mesh) {
    const points = [crossing(a, b, height), crossing(b, c, height), crossing(c, a, height)].filter(Boolean)
    if (points.length !== 2 || points[0].id === points[1].id) continue
    const key = points.map(p => p.id).sort().join('|')
    if (!unique.has(key)) unique.set(key, points)
  }
  return [...unique.values()]
}
