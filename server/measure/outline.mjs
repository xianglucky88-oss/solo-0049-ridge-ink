import { orient } from './geometry.mjs'

const Q = 1e-6

const quantize = value => Math.round(value / Q) * Q
const keyOf = (x, y) => `${Math.round(x / Q)},${Math.round(y / Q)}`

function ringEdges(polygon) {
  const points = orient(polygon)
  const edges = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    if (Math.hypot(b.x - a.x, b.y - a.y) <= Q) continue
    edges.push([{ x: quantize(a.x), y: quantize(a.y) }, { x: quantize(b.x), y: quantize(b.y) }])
  }
  return edges
}

class PointIndex {
  constructor(size, extent) {
    this.size = Math.max(extent / Math.max(8, Math.ceil(Math.sqrt(size))), 1e-3)
    this.buckets = new Map()
  }

  cell(x, y) {
    return `${Math.floor(x / this.size)}:${Math.floor(y / this.size)}`
  }

  add(point) {
    const id = this.cell(point.x, point.y)
    if (!this.buckets.has(id)) this.buckets.set(id, [])
    this.buckets.get(id).push(point)
  }

  near(a, b) {
    const c0 = Math.floor(Math.min(a.x, b.x) / this.size), c1 = Math.floor(Math.max(a.x, b.x) / this.size)
    const r0 = Math.floor(Math.min(a.y, b.y) / this.size), r1 = Math.floor(Math.max(a.y, b.y) / this.size)
    const found = new Map()
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (const point of this.buckets.get(`${c}:${r}`) ?? []) {
          found.set(keyOf(point.x, point.y), point)
        }
      }
    }
    return [...found.values()]
  }
}

function splitAtInteriorPoints(edge, index) {
  const [a, b] = edge
  const dx = b.x - a.x, dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared < Q * Q) return [edge]
  const cuts = []
  for (const point of index.near(a, b)) {
    const t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
    if (t <= 1e-9 || t >= 1 - 1e-9) continue
    const x = a.x + dx * t, y = a.y + dy * t
    if (Math.hypot(point.x - x, point.y - y) > Q * 2) continue
    cuts.push(t)
  }
  if (!cuts.length) return [edge]
  cuts.sort((p, q) => p - q)
  const stops = [0, ...cuts.filter((t, i) => i === 0 || t - cuts[i - 1] > 1e-9), 1]
  const result = []
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1], to = stops[i]
    result.push([
      { x: quantize(a.x + dx * from), y: quantize(a.y + dy * from) },
      { x: quantize(a.x + dx * to), y: quantize(a.y + dy * to) }
    ])
  }
  return result
}

// Outer boundary loops of a set of edge-adjacent pieces. Interior seams appear
// as opposing edge pairs and cancel; vertices lying on another piece's edge are
// inserted first so T-junctions still line up.
export function outlineLoops(pieces) {
  const raw = []
  let extent = 0, left = Infinity, bottom = Infinity
  for (const piece of pieces) {
    for (const edge of ringEdges(piece)) {
      raw.push(edge)
      for (const point of edge) {
        left = Math.min(left, point.x)
        bottom = Math.min(bottom, point.y)
        extent = Math.max(extent, Math.abs(point.x), Math.abs(point.y))
      }
    }
  }
  const index = new PointIndex(raw.length * 2, Math.max(extent, 1))
  // Shift into a positive frame so bucket keys stay stable around negatives.
  const shiftX = -left + 1, shiftY = -bottom + 1
  const points = new Map()
  for (const [a, b] of raw) {
    for (const point of [a, b]) points.set(keyOf(point.x, point.y), point)
  }
  for (const point of points.values()) index.add({ x: point.x + shiftX, y: point.y + shiftY })

  const split = raw.flatMap(edge => splitAtInteriorPoints(
    [{ x: edge[0].x + shiftX, y: edge[0].y + shiftY }, { x: edge[1].x + shiftX, y: edge[1].y + shiftY }],
    index
  ).map(([a, b]) => [{ x: a.x - shiftX, y: a.y - shiftY }, { x: b.x - shiftX, y: b.y - shiftY }]))

  const forward = new Map()
  for (const [a, b] of split) {
    const key = `${keyOf(a.x, a.y)}>${keyOf(b.x, b.y)}`
    forward.set(key, (forward.get(key) ?? 0) + 1)
  }
  const boundary = []
  for (const [a, b] of split) {
    const id = `${keyOf(a.x, a.y)}>${keyOf(b.x, b.y)}`
    const reverse = `${keyOf(b.x, b.y)}>${keyOf(a.x, a.y)}`
    if (forward.get(id) > 0 && (forward.get(reverse) ?? 0) > 0) {
      forward.set(id, forward.get(id) - 1)
      forward.set(reverse, forward.get(reverse) - 1)
    }
  }
  for (const [key, count] of forward) {
    if (count <= 0) continue
    const [from, to] = key.split('>')
    const [ax, ay] = from.split(',').map(Number), [bx, by] = to.split(',').map(Number)
    for (let i = 0; i < count; i++) boundary.push([{ x: ax * Q, y: ay * Q }, { x: bx * Q, y: by * Q }])
  }

  const out = new Map()
  for (const [a, b] of boundary) {
    const id = keyOf(a.x, a.y)
    if (!out.has(id)) out.set(id, [])
    out.get(id).push([a, b])
  }
  const loops = []
  const used = new Set()
  for (const [a, b] of boundary) {
    const id = `${keyOf(a.x, a.y)}>${keyOf(b.x, b.y)}`
    if (used.has(id)) continue
    const loop = []
    let current = [a, b]
    while (current) {
      const marker = `${keyOf(current[0].x, current[0].y)}>${keyOf(current[1].x, current[1].y)}`
      if (used.has(marker)) break
      used.add(marker)
      loop.push({ x: current[0].x, y: current[0].y })
      const candidates = out.get(keyOf(current[1].x, current[1].y)) ?? []
      current = candidates.find(([p, q]) => !used.has(`${keyOf(p.x, p.y)}>${keyOf(q.x, q.y)}`))
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}
