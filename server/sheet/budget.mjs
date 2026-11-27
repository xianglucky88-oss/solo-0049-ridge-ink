import { InputError } from '../http/error.mjs'
import { checkLevelParameters } from '../contour/levels.mjs'
import { segments } from '../contour/segments.mjs'
import { paths } from '../contour/paths.mjs'
import { clipSegment } from './clip-segment.mjs'
import { clipPath } from './clip-path.mjs'
import { compactLine } from './simplify.mjs'
import { drawingPointLimit, intervalFactors, levelLimit, lineLength } from './geometry.mjs'

const epsilon = 1e-9

export function isBudget(input) {
  const flag = input?.budget
  return flag === true || flag === 1 || flag === 'on' || flag === 'true'
}

function clipPolygon(polygon, { left, bottom, right, top }) {
  const sides = [
    [point => point.x >= left, 'x', left],
    [point => point.x <= right, 'x', right],
    [point => point.y >= bottom, 'y', bottom],
    [point => point.y <= top, 'y', top]
  ]
  let result = polygon
  for (const [inside, axis, value] of sides) {
    if (!result.length) break
    const kept = []
    for (let i = 0; i < result.length; i++) {
      const current = result[i]
      const previous = result[(i + result.length - 1) % result.length]
      const currentInside = inside(current)
      const previousInside = inside(previous)
      if (currentInside !== previousInside) {
        const t = (value - previous[axis]) / (current[axis] - previous[axis])
        kept.push({
          x: previous.x + (current.x - previous.x) * t,
          y: previous.y + (current.y - previous.y) * t,
          z: previous.z + (current.z - previous.z) * t
        })
      }
      if (currentInside) kept.push(current)
    }
    result = kept
  }
  return result
}

function polygonSpan(polygon) {
  let total = 0
  for (let i = 1; i < polygon.length; i++) {
    total += Math.hypot(polygon[i].x - polygon[i - 1].x, polygon[i].y - polygon[i - 1].y)
  }
  return polygon.length < 2 ? 0 : total
}

// Triangles that can put positive-length ink inside or on the closed frame.
// A triangle merely grazing the frame at one point has no positive-length
// part and is left out; it can never own a positive-length trace there.
function frameTriangles(mesh, bounds) {
  const result = []
  for (const triangle of mesh) {
    const polygon = clipPolygon(triangle.map(({ x, y, z }) => ({ x, y, z })), bounds)
    if (polygon.length < 2 || polygonSpan(polygon) <= epsilon) continue
    let low = Infinity, high = -Infinity
    for (const { z } of triangle) { low = Math.min(low, z); high = Math.max(high, z) }
    result.push({ triangle, low, high })
  }
  return result
}

function frameElevationRange(frames) {
  let low = Infinity, high = -Infinity
  for (const { low: triangleLow, high: triangleHigh } of frames) {
    low = Math.min(low, triangleLow)
    high = Math.max(high, triangleHigh)
  }
  return low <= high ? { low, high } : null
}

function zTolerance(height) {
  return 1e-9 * Math.max(1, Math.abs(height)) + 1e-12
}

function makeSweep(frames) {
  const sorted = [...frames].sort((a, b) => a.low - b.low)
  let next = 0
  let active = []
  return height => {
    const slack = zTolerance(height)
    while (next < sorted.length && sorted[next].low <= height + slack) active.push(sorted[next++])
    active = active.filter(entry => entry.high >= height - slack)
    return active.map(entry => entry.triangle)
  }
}

function hasTrace(triangles, height, bounds) {
  for (const [a, b] of segments(triangles, height)) {
    const part = clipSegment(a, b, bounds)
    if (part && Math.hypot(part.b.x - part.a.x, part.b.y - part.a.y) > epsilon) return true
  }
  return false
}

function levelAt(offset, baseInterval, index) {
  return offset + index * baseInterval
}

// Base-index window whose levels can carry ink inside the frame. The frame
// triangle sweeping only widens this, never narrows it, and hasTrace filters
// the remainder, so the window can be conservative.
function baseWindow(frames, baseInterval, offset) {
  const range = frameElevationRange(frames)
  if (!range) return null
  const tolerance = 1e-6
  return {
    range,
    first: Math.ceil((range.low - offset) / baseInterval - tolerance),
    last: Math.floor((range.high - offset) / baseInterval + tolerance)
  }
}

// Walk the candidate indices of one tier in ascending order and report those
// that carry ink inside the frame. Levels grazing an isolated frame point, or
// lying wholly outside, are passed over and take no slot. The index grid is
// shared across tiers (index n means offset + n * baseInterval), so a coarser
// tier is always a subset of a finer one and probe results can be reused.
function activeIndices(frames, offset, baseInterval, factor, window, probes, limit) {
  const start = factor * Math.ceil(window.first / factor)
  const at = makeSweep(frames)
  const result = []
  for (let index = start; index <= window.last; index += factor) {
    let carries = probes.get(index)
    if (carries === undefined) {
      const height = levelAt(offset, baseInterval, index)
      carries = hasTrace(at(height), height, window.bounds)
      probes.set(index, carries)
    }
    if (carries) {
      result.push(index)
      if (limit != null && result.length > limit) return result
    }
  }
  return result
}

// The finest interval on offer (1, 2, 5 or 10 base intervals) that carries ink
// at no more than 100 levels. If even the tenfold principal tier is over the
// level cap, report a level-limit failure.
export function chooseTier(mesh, baseInterval, offset, bounds) {
  checkLevelParameters(baseInterval, offset)
  const frames = frameTriangles(mesh, bounds)
  const window = baseWindow(frames, baseInterval, offset)
  if (!window) throw new InputError('选幅内没有可制图的三角面。', 422)
  window.bounds = bounds
  const probes = new Map()
  for (const factor of intervalFactors) {
    const active = activeIndices(frames, offset, baseInterval, factor, window, probes, levelLimit)
    if (active.length <= levelLimit) {
      return { factor, interval: baseInterval * factor, window, frames, probes }
    }
  }
  throw new InputError('等高线级数超过 100（级数超限，主曲线本身已超过级数上限），请增大基础等高距。', 422)
}

export function budgetLayers(tier, mesh, offset, baseInterval, bounds) {
  const { factor, interval, window, frames, probes } = tier
  const indices = activeIndices(frames, offset, baseInterval, factor, window, probes)
  // Build the final layers from the whole mesh, exactly as an ordinary sheet
  // would at this interval: clipping then keeps every in-frame trace with its
  // original bends, switchbacks, closures, branch and crop endpoints and the
  // breaks left by missing data. The frame-triangle scan above only decides
  // which levels carry ink and therefore take a slot.
  const layers = []
  let points = 0
  for (const index of indices) {
    const height = levelAt(offset, baseInterval, index)
    const lines = paths(segments(mesh, height))
      .flatMap(line => clipPath(line, bounds))
      .map(compactLine)
      .filter(line => lineLength(line) > epsilon)
    if (!lines.length) continue
    for (const line of lines) points += line.length
    if (points > drawingPointLimit) {
      throw new InputError('绘图顶点超过 200000（顶点超限，保持原线迹无法再压缩），请缩小图幅或增大基础等高距。', 422)
    }
    layers.push({
      height,
      paths: lines,
      loops: lines.filter(line => line[0].id && line[0].id === line.at(-1).id).length
    })
  }
  if (layers.length > levelLimit) {
    throw new InputError('等高线级数超过 100（级数超限），请增大基础等高距。', 422)
  }
  return { layers, points, interval }
}
