import { heightAt } from '../terrain/height.mjs'
import { triangles } from '../terrain/mesh.mjs'

const parameterEpsilon = 1e-9

// 沿整条测线求有观测支撑的折线：三角面边与测线的交点是坡折候选，
// 共边只产生一个里程事件；区间内部是否有有效面用中点判读，事件点单独判读。
export function trace(surface, section) {
  const { x1, y1, x2, y2, length } = section
  const dx = x2 - x1, dy = y2 - y1
  const sectionScale = Math.hypot(dx, dy)

  const events = new Set([0, 1])
  const edges = new Map()
  for (const triangle of triangles(surface)) {
    for (let e = 0; e < 3; e++) {
      const a = triangle[e], b = triangle[(e + 1) % 3]
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`
      if (!edges.has(key)) edges.set(key, [a, b])
    }
  }
  for (const [a, b] of edges.values()) {
    const ex = b.x - a.x, ey = b.y - a.y
    const cross = dx * ey - dy * ex
    if (Math.abs(cross) <= 1e-10 * Math.max(1, sectionScale * Math.hypot(ex, ey))) continue
    const apx = a.x - x1, apy = a.y - y1
    const t = (apx * ey - apy * ex) / cross
    const s = (apx * dy - apy * dx) / cross
    if (t < -parameterEpsilon || t > 1 + parameterEpsilon ||
      s < -parameterEpsilon || s > 1 + parameterEpsilon) continue
    events.add(Math.min(1, Math.max(0, t)))
  }

  const params = [...events].sort((a, b) => a - b).reduce((list, t) => {
    if (!list.length || t - list.at(-1) > parameterEpsilon) list.push(t)
    return list
  }, [])
  const at = t => ({ t, distance: length * t, x: x1 + dx * t, y: y1 + dy * t })
  const nodes = params.map(t => {
    const point = at(t)
    return { ...point, z: heightAt(surface, point.x, point.y) }
  })
  const intervalCovered = nodes.slice(0, -1).map((node, i) => {
    const point = at((node.t + nodes[i + 1].t) / 2)
    return heightAt(surface, point.x, point.y) !== null
  })

  const reading = node => ({ distance: node.distance, z: node.z })
  const result = { segments: [], gaps: [], isolated: [] }

  // 缺测区间：连续无观测的区间合并；遇到有读数的事件点即断开，
  // 这样孤立读数两侧的缺测各自成段。
  let i = 0
  while (i < nodes.length - 1) {
    if (intervalCovered[i]) { i++; continue }
    let j = i
    while (j + 1 < nodes.length - 1 && !intervalCovered[j + 1] && nodes[j + 1].z === null) j++
    result.gaps.push({ start: nodes[i].distance, end: nodes[j + 1].distance })
    i = j + 1
  }

  // 有观测部分：被有观测区间连起来的事件点成折线，单点不成段则记为孤立读数。
  let k = 0
  while (k < nodes.length) {
    let j = k
    while (j + 1 < nodes.length && intervalCovered[j]) j++
    if (j === k) {
      if (nodes[k].z !== null) result.isolated.push(reading(nodes[k]))
    } else {
      result.segments.push({ points: nodes.slice(k, j + 1).map(reading) })
    }
    k = j + 1
  }
  return result
}
