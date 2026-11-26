export function crossing(a, b, height) {
  if ((a.z < height) === (b.z < height)) return null
  if (a.id > b.id) [a, b] = [b, a]
  if (a.z === height) return { id: `v${a.id}`, x: a.x, y: a.y }
  if (b.z === height) return { id: `v${b.id}`, x: b.x, y: b.y }
  const f = (height - a.z) / (b.z - a.z)
  return { id: `e${a.id}:${b.id}`, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
}
