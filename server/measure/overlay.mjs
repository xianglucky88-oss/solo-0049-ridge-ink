import { cell } from '../terrain/mesh.mjs'
import { orient, area, EPS } from './geometry.mjs'

// Plane z = a*x + b*y + c0 through three terrain vertices.
export function makePlane([p, q, r]) {
  const det = (q.x - p.x) * (r.y - p.y) - (r.x - p.x) * (q.y - p.y)
  if (Math.abs(det) < 1e-12) return { a: 0, b: 0, c0: (p.z + q.z + r.z) / 3 }
  const a = ((q.z - p.z) * (r.y - p.y) - (r.z - p.z) * (q.y - p.y)) / det
  const b = ((r.z - p.z) * (q.x - p.x) - (q.z - p.z) * (r.x - p.x)) / det
  return { a, b, c0: p.z - a * p.x - b * p.y }
}

export function planeDepth(plane, x, y) {
  return plane.a * x + plane.b * y + plane.c0
}

function clipConvex(subject, clip) {
  const clipPolygon = orient(clip)
  let output = subject
  for (let i = 0; i < clipPolygon.length && output.length; i++) {
    const a = clipPolygon[i], b = clipPolygon[(i + 1) % clipPolygon.length]
    const nx = a.y - b.y, ny = b.x - a.x
    const side = point => nx * (point.x - a.x) + ny * (point.y - a.y)
    const input = output
    output = []
    for (let j = 0; j < input.length; j++) {
      const p = input[j], q = input[(j + 1) % input.length]
      const fp = side(p), fq = side(q)
      if (fp >= -EPS) output.push(p)
      if (fp > EPS && fq < -EPS || fp < -EPS && fq > EPS) {
        const t = fp / (fp - fq)
        output.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t })
      }
    }
  }
  return output.length >= 3 && area(output) > EPS ? output : null
}

const close = (a, b) => Math.abs(a - b) <= 1e-9

function uniqueSorted(values, low, high) {
  const sorted = [...values].filter(value => value > low + 1e-9 && value < high - 1e-9).sort((a, b) => a - b)
  const result = [low]
  for (const value of sorted) {
    if (!close(value, result.at(-1))) result.push(value)
  }
  if (!close(result.at(-1), high)) result.push(high)
  return result
}

function lines(origin, unit, low, high) {
  const first = Math.ceil((low - origin) / unit - 1e-9)
  const last = Math.floor((high - origin) / unit + 1e-9)
  const values = []
  for (let i = first; i <= last; i++) {
    const value = origin + i * unit
    if (value >= low - 1e-9 && value <= high + 1e-9) values.push(value)
  }
  return values
}

// Grid cell covering a point, or null when outside the surface frame.
function cellAt(surface, x, y) {
  const px = (x - surface.originX) / surface.unit
  const py = (y - surface.originY) / surface.unit
  if (px < -1e-9 || py < -1e-9 || px > surface.width - 1 + 1e-9 || py > surface.height - 1 + 1e-9) return null
  const column = Math.min(surface.width - 2, Math.max(0, Math.floor(px + 1e-9)))
  const row = Math.min(surface.height - 2, Math.max(0, Math.floor(py + 1e-9)))
  return cell(surface, column, row)
}

const valid = triangle => triangle.every(vertex => vertex.z !== null)

function frameOf(surface) {
  return [
    { x: surface.originX, y: surface.originY },
    { x: surface.right, y: surface.originY },
    { x: surface.right, y: surface.top },
    { x: surface.originX, y: surface.top }
  ]
}

// Split a convex polygon by the cell diagonal so each piece lies in one
// triangle. The first triangle is on the negative side of the diagonal, the
// second on the positive side.
function diagonalPieces(polygon, triangles) {
  const [first, second] = triangles
  const a = first[0], d = first[2]
  const dx = d.x - a.x, dy = d.y - a.y
  const side = point => dx * (point.y - a.y) - dy * (point.x - a.x)
  const values = polygon.map(side)
  const low = values.some(value => value < -EPS), high = values.some(value => value > EPS)
  if (!low || !high) return [{ polygon, triangle: low ? first : high ? second : first }]
  const negative = [], positive = []
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length]
    const fp = values[i], fq = values[(i + 1) % polygon.length]
    if (fp <= EPS) negative.push(p)
    if (fp >= -EPS) positive.push(p)
    if (fp < -EPS && fq > EPS || fp > EPS && fq < -EPS) {
      const t = fp / (fp - fq)
      const point = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }
      negative.push(point)
      positive.push(point)
    }
  }
  return [
    { polygon: negative.length >= 3 ? negative : null, triangle: first },
    { polygon: positive.length >= 3 ? positive : null, triangle: second }
  ].filter(piece => piece.polygon && area(piece.polygon) > EPS)
}

// Pieces of the rectangle covered by one surface, exactly partitioning it.
// Wings outside the surface frame carry no triangle and are treated as missing.
function surfacePieces(surface, rect, triangles) {
  const [r, f] = [rect, frameOf(surface)]
  const left = Math.max(r[0].x, f[0].x), bottom = Math.max(r[0].y, f[0].y)
  const right = Math.min(r[2].x, f[2].x), top = Math.min(r[2].y, f[2].y)
  const pieces = []
  if (right > left + 1e-9 && top > bottom + 1e-9) {
    const inner = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }]
    if (!triangles) pieces.push({ polygon: inner, triangle: null })
    else pieces.push(...diagonalPieces(inner, triangles))
    const strips = [
      [{ x: r[0].x, y: r[0].y }, { x: left, y: r[0].y }, { x: left, y: r[2].y }, { x: r[0].x, y: r[2].y }],
      [{ x: right, y: r[0].y }, { x: r[2].x, y: r[0].y }, { x: r[2].x, y: r[2].y }, { x: right, y: r[2].y }],
      [{ x: left, y: r[0].y }, { x: right, y: r[0].y }, { x: right, y: bottom }, { x: left, y: bottom }],
      [{ x: left, y: top }, { x: right, y: top }, { x: right, y: r[2].y }, { x: left, y: r[2].y }]
    ]
    for (const strip of strips) {
      if (area(strip) > EPS) pieces.push({ polygon: strip, triangle: null })
    }
  } else {
    pieces.push({ polygon: rect, triangle: null })
  }
  return pieces
}

// Full planar partition of the sheet by both grids. Every rectangle of the
// combined grid-line lattice is split by the relevant diagonals, then the two
// surfaces' triangles are intersected. Each cell records the pair of planes,
// or marks a surface as missing there.
export function partitionSheet(existing, design, bounds) {
  const xs = uniqueSorted([
    ...lines(existing.originX, existing.unit, bounds.left, bounds.right),
    ...lines(design.originX, design.unit, bounds.left, bounds.right)
  ], bounds.left, bounds.right)
  const ys = uniqueSorted([
    ...lines(existing.originY, existing.unit, bounds.bottom, bounds.top),
    ...lines(design.originY, design.unit, bounds.bottom, bounds.top)
  ], bounds.bottom, bounds.top)

  const cells = []
  for (let j = 0; j < ys.length - 1; j++) {
    for (let i = 0; i < xs.length - 1; i++) {
      const left = xs[i], right = xs[i + 1], bottom = ys[j], top = ys[j + 1]
      if (right - left <= 1e-9 || top - bottom <= 1e-9) continue
      const rect = [{ x: left, y: bottom }, { x: right, y: bottom }, { x: right, y: top }, { x: left, y: top }]
      const cx = (left + right) / 2, cy = (bottom + top) / 2
      const existingPieces = surfacePieces(existing, rect, cellAt(existing, cx, cy))
      const designPieces = surfacePieces(design, rect, cellAt(design, cx, cy))
      for (const leftPiece of existingPieces) {
        for (const rightPiece of designPieces) {
          const polygon = clipConvex(leftPiece.polygon, rightPiece.polygon)
          if (!polygon) continue
          if (!leftPiece.triangle || !valid(leftPiece.triangle) || !rightPiece.triangle || !valid(rightPiece.triangle)) {
            cells.push({ polygon, kind: 'unknown' })
          } else {
            cells.push({
              polygon, kind: 'measure',
              existingPlane: makePlane(leftPiece.triangle),
              designPlane: makePlane(rightPiece.triangle)
            })
          }
        }
      }
    }
  }
  return cells
}
