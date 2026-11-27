const tolerance = 1e-9

function straight(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y
  const bcx = c.x - b.x, bcy = c.y - b.y
  if (abx * bcx + aby * bcy < 0) return false
  const cross = abx * bcy - aby * bcx
  const scale = Math.hypot(abx, aby) * Math.hypot(bcx, bcy)
  return Math.abs(cross) <= tolerance * scale
}

// A line may keep its shape with fewer pen points: interior points that lie
// on the straight run between their neighbours are redundant. Switchbacks,
// bends, branch and crop endpoints stay put. A repeated closing point of a
// loop is part of the line and is never merged away.
export function compactLine(line) {
  if (line.length <= 2) return line
  const kept = [line[0]]
  for (let i = 1; i < line.length - 1; i++) {
    if (!straight(kept[kept.length - 1], line[i], line[i + 1])) kept.push(line[i])
  }
  kept.push(line.at(-1))
  return kept
}

export function compactLayer(layer) {
  return { ...layer, paths: layer.paths.map(compactLine) }
}

export function drawingPoints(layers) {
  return layers.reduce((total, layer) =>
    total + layer.paths.reduce((sum, line) => sum + line.length, 0), 0)
}
