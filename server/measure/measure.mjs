import { createHash } from 'node:crypto'
import { InputError } from '../http/error.mjs'
import { splitLinear, centroid, orient } from './geometry.mjs'
import { partitionSheet, planeDepth } from './overlay.mjs'

const DEPTH_EPS = 1e-7
const EDGE_EPS = 1e-7
const TOUCH_EPS = 1e-6
const round = n => Number(n.toFixed(6))

function signedArea(polygon) {
  let total = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}

function polygonArea(polygon) {
  return Math.abs(signedArea(polygon))
}

function perimeterEdges(polygon) {
  const points = orient(polygon)
  const edges = []
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    if (Math.hypot(b.x - a.x, b.y - a.y) > EDGE_EPS) edges.push([a, b])
  }
  return edges
}

// Collinear overlap of two segments: endpoints, midpoint and length. Works for
// partial overlaps in either direction (including T-junctions).
function segmentOverlap(a1, a2, b1, b2) {
  const ax = a2.x - a1.x, ay = a2.y - a1.y
  const bx = b2.x - b1.x, by = b2.y - b1.y
  const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
  if (la <= EDGE_EPS || lb <= EDGE_EPS) return null
  const offA = Math.max(
    Math.abs(ax * (b1.y - a1.y) - ay * (b1.x - a1.x)),
    Math.abs(ax * (b2.y - a1.y) - ay * (b2.x - a1.x))
  ) / la
  const offB = Math.max(
    Math.abs(bx * (a1.y - b1.y) - by * (a1.x - b1.x)),
    Math.abs(bx * (a2.y - b1.y) - by * (a2.x - b1.x))
  ) / lb
  if (Math.max(offA, offB) > TOUCH_EPS) return null
  const project = point => ((point.x - a1.x) * ax + (point.y - a1.y) * ay) / (la * la)
  const start = Math.max(0, Math.min(project(b1), project(b2)))
  const end = Math.min(1, Math.max(project(b1), project(b2)))
  const length = (end - start) * la
  if (length <= EDGE_EPS) return null
  const at = t => ({ x: a1.x + ax * t, y: a1.y + ay * t })
  return { a: at(start), b: at(end), midpoint: at((start + end) / 2), length }
}

class EdgeIndex {
  constructor(bounds, count) {
    this.left = bounds.left
    this.bottom = bounds.bottom
    const extent = Math.max(bounds.right - bounds.left, bounds.top - bounds.bottom)
    const divisions = Math.max(32, Math.min(512, Math.ceil(Math.sqrt(count * 3))))
    this.size = Math.max(extent / divisions, 1e-6)
    this.buckets = new Map()
    this.items = []
  }

  insert(piece, a, b) {
    const id = this.items.length
    this.items.push({ piece, a, b })
    const c0 = Math.floor((Math.min(a.x, b.x) - this.left) / this.size)
    const c1 = Math.floor((Math.max(a.x, b.x) - this.left) / this.size)
    const r0 = Math.floor((Math.min(a.y, b.y) - this.bottom) / this.size)
    const r1 = Math.floor((Math.max(a.y, b.y) - this.bottom) / this.size)
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const key = `${c}:${r}`
        if (!this.buckets.has(key)) this.buckets.set(key, [])
        this.buckets.get(key).push(id)
      }
    }
  }

  pairs() {
    const seen = new Set()
    const result = []
    for (const ids of this.buckets.values()) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const a = ids[i], b = ids[j]
          if (a === b || this.items[a].piece === this.items[b].piece) continue
          const key = a < b ? `${a}:${b}` : `${b}:${a}`
          if (seen.has(key)) continue
          seen.add(key)
          result.push([a, b])
        }
      }
    }
    return result
  }
}

// Group neighbouring pieces of one kind. Pieces join only when they share an
// edge segment that carries real cut or fill depth somewhere along it. Vertex
// touches and stretches of exactly zero depth leave zones separate.
function mergePieces(pieces, kind) {
  let left = Infinity, bottom = Infinity, right = -Infinity, top = -Infinity
  for (const piece of pieces) {
    for (const point of piece.polygon) {
      if (point.x < left) left = point.x
      if (point.x > right) right = point.x
      if (point.y < bottom) bottom = point.y
      if (point.y > top) top = point.y
    }
  }
  const edges = pieces.map(piece => perimeterEdges(piece.polygon))
  const index = new EdgeIndex({ left, bottom, right, top }, edges.reduce((total, list) => total + list.length, 0))
  edges.forEach((list, id) => list.forEach(([a, b]) => index.insert(id, a, b)))

  const parent = Array.from({ length: pieces.length }, (_, i) => i)
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]))
  const join = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra }

  for (const [i, j] of index.pairs()) {
    const first = index.items[i], second = index.items[j]
    const overlap = segmentOverlap(first.a, first.b, second.a, second.b)
    if (!overlap) continue
    const plane = pieces[first.piece].depthPlane
    const da = planeDepth(plane, overlap.a.x, overlap.a.y)
    const db = planeDepth(plane, overlap.b.x, overlap.b.y)
    const real = kind === 'cut' ? Math.min(da, db) < -DEPTH_EPS : Math.max(da, db) > DEPTH_EPS
    if (real) join(first.piece, second.piece)
  }

  const groups = new Map()
  pieces.forEach((piece, id) => {
    const root = find(id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(piece)
  })
  return [...groups.values()]
}

function componentStats(pieces) {
  let areaSum = 0, volume = 0, minX = Infinity, minY = Infinity
  let biggest = null
  for (const piece of pieces) {
    const pieceArea = polygonArea(piece.polygon)
    const center = centroid(piece.polygon)
    const depth = Math.abs(planeDepth(piece.depthPlane, center.x, center.y))
    areaSum += pieceArea
    volume += pieceArea * depth
    for (const point of piece.polygon) {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
    }
    if (!biggest || pieceArea > biggest.area) biggest = { area: pieceArea, center }
  }
  return { area: areaSum, volume, minX, minY, label: biggest?.center }
}

function tidy(polygon) {
  const points = []
  for (const point of polygon) {
    const last = points.at(-1)
    if (!last || Math.abs(last.x - point.x) > 1e-9 || Math.abs(last.y - point.y) > 1e-9) {
      points.push({ x: round(point.x), y: round(point.y) })
    }
  }
  while (points.length > 1 && Math.abs(points[0].x - points.at(-1).x) < 1e-9 && Math.abs(points[0].y - points.at(-1).y) < 1e-9) points.pop()
  return points
}

function buildZones(existing, design, bounds) {
  const cells = partitionSheet(existing, design, bounds)
  const cutPieces = [], fillPieces = [], nonePieces = [], unknownPieces = []
  for (const cell of cells) {
    if (cell.kind === 'unknown') { unknownPieces.push(tidy(orient(cell.polygon))); continue }
    const depthPlane = {
      a: cell.designPlane.a - cell.existingPlane.a,
      b: cell.designPlane.b - cell.existingPlane.b,
      c0: cell.designPlane.c0 - cell.existingPlane.c0
    }
    const split = splitLinear(cell.polygon, point => planeDepth(depthPlane, point.x, point.y), DEPTH_EPS)
    if (split.zero) nonePieces.push(tidy(orient(split.zero)))
    if (split.negative) cutPieces.push({ polygon: split.negative, depthPlane })
    if (split.positive) fillPieces.push({ polygon: split.positive, depthPlane })
  }

  const zones = []
  for (const [kind, pieces] of [['cut', cutPieces], ['fill', fillPieces]]) {
    const components = mergePieces(pieces, kind).map(group => ({ group, ...componentStats(group) }))
    components.sort((a, b) => a.minX - b.minX || a.minY - b.minY)
    const prefix = kind === 'cut' ? 'C' : 'F'
    components.forEach((component, index) => {
      zones.push({
        id: `${prefix}${index + 1}`,
        kind,
        area: component.area,
        volume: component.volume,
        label: { x: round(component.label.x), y: round(component.label.y) },
        pieces: component.group.map(piece => tidy(orient(piece.polygon)))
      })
    })
  }

  return {
    zones,
    nonePieces,
    noneArea: nonePieces.reduce((total, polygon) => total + polygonArea(polygon), 0),
    unknownPieces,
    unknownArea: unknownPieces.reduce((total, polygon) => total + polygonArea(polygon), 0)
  }
}

export function measure(existing, design, bounds) {
  const built = buildZones(existing, design, bounds)
  return { ...built, sheetId: sheetIdentity(existing, design, bounds), totals: totalsOf(built.zones) }
}

export function sheetIdentity(existing, design, bounds) {
  const shape = surface => ({
    width: surface.width, height: surface.height, unit: surface.unit,
    originX: surface.originX, originY: surface.originY,
    elevations: surface.vertices.map(point => point.z)
  })
  return createHash('sha256').update(JSON.stringify({
    existing: shape(existing), design: shape(design),
    bounds: [bounds.left, bounds.bottom, bounds.right, bounds.top]
  })).digest('hex').slice(0, 16)
}

export function totalsOf(zones) {
  const totals = { cut: { area: 0, volume: 0 }, fill: { area: 0, volume: 0 } }
  for (const zone of zones) {
    totals[zone.kind].area += zone.area
    totals[zone.kind].volume += zone.volume
  }
  return totals
}

// A selection is only valid for the exact sheet that produced its zone ids.
// Old selections keep their sheet identity, so even unchanged zone numbers are
// rejected once the grid or crop changes.
export function validateSelection(selection, identity, zones) {
  if (selection == null) return null
  if (typeof selection !== 'object' || Array.isArray(selection)) throw new InputError('选片信息无效，请重新选片。')
  if (selection.sheetId !== identity) throw new InputError('选片来自另一张核量图，请重新选片。')
  const list = selection.zones
  if (!Array.isArray(list) || !list.length) throw new InputError('请先选择工区再导出交底图。')
  const available = new Set(zones.map(zone => zone.id))
  for (const id of list) {
    if (typeof id !== 'string' || !available.has(id)) throw new InputError('片号不属于当前核量图，请重新选片。')
  }
  return zones.filter(zone => list.includes(zone.id))
}
