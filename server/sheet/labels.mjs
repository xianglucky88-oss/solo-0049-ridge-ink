import { InputError } from '../http/error.mjs'
import { incident } from '../terrain/incident.mjs'
import { clipSegment } from './clip-segment.mjs'

// 字框以圈上点为中心：文字内框 + 四向留白，整体必须落在图框内。
export function labelFont(bounds) {
  return Math.max(Math.hypot(bounds.right - bounds.left, bounds.top - bounds.bottom) / 40, 0.001)
}

export function formatHeight(height) {
  return String(Number(height.toFixed(6)))
}

function outerBox(height, point, fontSize) {
  const chars = formatHeight(height).length
  const width = fontSize * (0.62 * chars + 1.9)
  const halfWidth = width / 2
  const halfHeight = fontSize * 1.2
  const pad = fontSize * 0.55
  return {
    left: point.x - halfWidth, right: point.x + halfWidth,
    bottom: point.y - halfHeight, top: point.y + halfHeight, pad,
    innerLeft: point.x - halfWidth + pad, innerRight: point.x + halfWidth - pad,
    innerBottom: point.y - halfHeight + pad, innerTop: point.y + halfHeight - pad
  }
}

function insideFrame(box, bounds) {
  return box.left >= bounds.left && box.right <= bounds.right &&
    box.bottom >= bounds.bottom && box.top <= bounds.top
}

// 留白区域不允许覆盖缺测面：对内框做固定网格探测。
function coversMissing(surface, box) {
  const samples = 5
  for (let row = 0; row < samples; row++) {
    for (let column = 0; column < samples; column++) {
      const x = box.innerLeft + (box.innerRight - box.innerLeft) * column / (samples - 1)
      const y = box.innerBottom + (box.innerTop - box.innerBottom) * row / (samples - 1)
      if (!incident(surface, x, y)) return true
    }
  }
  return false
}

// 圈上离给定点最近的位置（折线分段比较，并列时取先出现的分段，保证确定）。
export function nearestOnLoop(line, point) {
  let best = { x: line.points[0].x, y: line.points[0].y, distance: Infinity, index: -1 }
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1], b = line.points[i]
    const dx = b.x - a.x, dy = b.y - a.y
    const length2 = dx * dx + dy * dy
    const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2))
    const x = a.x + dx * t, y = a.y + dy * t
    const distance = Math.hypot(x - point.x, y - point.y)
    if (distance < best.distance) best = { x, y, distance, index: i - 1 }
  }
  return best
}

// 等高线段的网格空间索引，用于字框与相邻等高线的避让查询。
function buildIndex(layers, cellSize) {
  const cells = new Map()
  const keyOf = (cx, cy) => `${cx}:${cy}`
  layers.forEach((layer, levelIndex) => {
    layer.lines.forEach((line, lineIndex) => {
      line.points.forEach((point, pointIndex) => {
        if (pointIndex + 1 >= line.points.length) return
        const a = point, b = line.points[pointIndex + 1]
        const minX = Math.floor(Math.min(a.x, b.x) / cellSize)
        const maxX = Math.floor(Math.max(a.x, b.x) / cellSize)
        const minY = Math.floor(Math.min(a.y, b.y) / cellSize)
        const maxY = Math.floor(Math.max(a.y, b.y) / cellSize)
        const entry = { a, b, loopId: line.loopId, key: `${levelIndex}/${lineIndex}/${pointIndex}` }
        for (let cx = minX; cx <= maxX; cx++) for (let cy = minY; cy <= maxY; cy++) {
          const key = keyOf(cx, cy)
          if (!cells.has(key)) cells.set(key, [])
          cells.get(key).push(entry)
        }
      })
    })
  })
  return {
    cells, cellSize,
    intersecting(box, skipLoopId) {
      const minX = Math.floor(box.left / cellSize), maxX = Math.floor(box.right / cellSize)
      const minY = Math.floor(box.bottom / cellSize), maxY = Math.floor(box.top / cellSize)
      const seen = new Set()
      for (let cx = minX; cx <= maxX; cx++) for (let cy = minY; cy <= maxY; cy++) {
        for (const entry of cells.get(keyOf(cx, cy)) ?? []) {
          if (entry.loopId === skipLoopId || seen.has(entry.key)) continue
          seen.add(entry.key)
          if (clipSegment(entry.a, entry.b, box)) return true
        }
      }
      return false
    }
  }
}

function overlapsLabel(box, placed) {
  return placed.some(item =>
    box.left < item.box.right && box.right > item.box.left &&
    box.bottom < item.box.top && box.top > item.box.bottom)
}

// 字框连同留白：在图框内、不压缺测区、不碰相邻等高线、不压其他标注。
function fits(surface, bounds, index, placed, height, point, fontSize, loopId) {
  const box = outerBox(height, point, fontSize)
  if (!insideFrame(box, bounds)) return { ok: false, box, reason: 'frame' }
  if (coversMissing(surface, box)) return { ok: false, box, reason: 'missing' }
  if (index.intersecting(box, loopId)) return { ok: false, box, reason: 'contour' }
  if (overlapsLabel(box, placed)) return { ok: false, box, reason: 'label' }
  return { ok: true, box }
}

const reasonText = {
  frame: '原圈最近位置放不下字框：字框连同留白必须处于图框内。',
  missing: '原圈最近位置放不下字框：留白区域不能覆盖缺测区。',
  contour: '原圈最近位置放不下字框：与相邻等高线距离不足。',
  label: '原圈最近位置放不下字框：与其他标注重叠。'
}

// 沿闭环按固定弧长步长给候选点，首个可放位置即确定结果。
function autoPlace(registryEntry, surface, bounds, index, placed, fontSize) {
  const { line, height, loopId } = registryEntry
  const segments = []
  let perimeter = 0
  for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1], b = line.points[i]
    const length = Math.hypot(b.x - a.x, b.y - a.y)
    segments.push({ a, b, length, start: perimeter })
    perimeter += length
  }
  if (!perimeter) return null
  const pointAt = distance => {
    const d = distance % perimeter
    const segment = segments.find(item => d <= item.start + item.length) ?? segments.at(-1)
    const t = segment.length === 0 ? 0 : (d - segment.start) / segment.length
    return { x: segment.a.x + (segment.b.x - segment.a.x) * t, y: segment.a.y + (segment.b.y - segment.a.y) * t }
  }
  const count = Math.min(4000, Math.max(1, Math.ceil(perimeter / fontSize)))
  for (let i = 0; i < count; i++) {
    const result = fits(surface, bounds, index, placed, height, pointAt(perimeter * i / count), fontSize, loopId)
    if (result.ok) return result.box
  }
  return null
}

export function parseManualLabels(input, registry) {
  if (input == null) return []
  if (!Array.isArray(input)) throw new InputError('标注调整需要使用数组。')
  return input.map((item, index) => {
    if (!item || typeof item !== 'object' || !Number.isFinite(item.x) || !Number.isFinite(item.y) ||
      typeof item.loopId !== 'string' || !item.loopId) {
      throw new InputError(`第 ${index + 1} 条标注调整缺少闭环编号或落点坐标。`)
    }
    if (!registry.has(item.loopId)) throw new InputError('找不到要调整的标注闭环。')
    return { loopId: item.loopId, x: item.x, y: item.y }
  })
}

// 先按提交顺序处理手动调整，再按闭环编号顺序补齐自动标注；同一地形与分级结果确定。
export function placeLabels({ surface, bounds, layers, registry, manual, fontSize }) {
  const index = buildIndex(layers, Math.max(fontSize * 4, 1))
  const placed = []
  const records = []
  const handled = new Set()

  for (const move of manual) {
    const entry = registry.get(move.loopId)
    const { line, height, loopId } = entry
    if (move.x < bounds.left || move.x > bounds.right || move.y < bounds.bottom || move.y > bounds.top) {
      throw new InputError('落点在图框外，标注保持上次确认的位置。', 422)
    }
    const nearest = nearestOnLoop(line, move)
    const result = fits(surface, bounds, index, placed, height, nearest, fontSize, loopId)
    if (!result.ok) throw new InputError(reasonText[result.reason], 422)
    records.push({ loopId, height, x: nearest.x, y: nearest.y, box: result.box, manual: true })
    placed.push({ loopId, box: result.box })
    handled.add(loopId)
  }

  let skipped = 0
  for (const [loopId, entry] of registry) {
    if (handled.has(loopId)) continue
    const box = autoPlace(entry, surface, bounds, index, placed, fontSize)
    if (!box) { skipped++; continue }
    records.push({ loopId, height: entry.height,
      x: (box.left + box.right) / 2, y: (box.bottom + box.top) / 2, box, manual: false })
    placed.push({ loopId, box })
  }
  records.sort((a, b) => a.loopId < b.loopId ? -1 : a.loopId > b.loopId ? 1 : 0)
  return { records, skipped }
}
