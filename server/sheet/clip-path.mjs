import { clipSegmentDetailed, geomTolerance } from './clip-segment.mjs'

// 从参数区间 [lo, hi] 中挖去 cuts（若干 [u0,u1]），返回保留下来的有序区间。
function subtractIntervals(lo, hi, cuts) {
  const clipped = cuts
    .map(([u0, u1]) => [Math.max(lo, Math.min(u0, u1)), Math.min(hi, Math.max(u0, u1))])
    .filter(([u0, u1]) => u1 > u0)
    .sort((a, b) => a[0] - b[0])
  const merged = []
  for (const [u0, u1] of clipped) {
    const last = merged.at(-1)
    if (last && u0 <= last[1]) last[1] = Math.max(last[1], u1)
    else merged.push([u0, u1])
  }
  const rest = []
  let cursor = lo
  for (const [u0, u1] of merged) {
    if (u0 > cursor) rest.push([cursor, u0])
    cursor = Math.max(cursor, u1)
  }
  if (cursor < hi) rest.push([cursor, hi])
  return rest
}

// 计算一条已裁入幅内的线段，哪些部分因“正好沿共边”而不归本幅印制。
// 返回需要保留的参数区间（相对整条原始线段的 t）。
function ownedIntervals(a, part, bounds, policy, eps) {
  const { lo, hi } = part
  const p = part.a, q = part.b
  const vertical = Math.abs(p.x - q.x) <= eps
  const horizontal = Math.abs(p.y - q.y) <= eps

  let axis = null, covered
  if (vertical && Math.abs(p.x - bounds.left) <= eps) {
    // 竖共边的东侧幅：左边上的沿线段归西幅。
    axis = 'y'
    covered = policy === 'direction' ? 'all' : (policy?.left ?? [])
  } else if (horizontal && Math.abs(p.y - bounds.bottom) <= eps) {
    // 横共边的北侧幅：底边上的沿线段归南幅。
    axis = 'x'
    covered = policy === 'direction' ? 'all' : (policy?.bottom ?? [])
  } else {
    return [[lo, hi]]
  }

  // 绝对方向规则：整条沿边段都归对侧幅。
  if (covered === 'all') return []
  if (!Array.isArray(covered) || !covered.length) return [[lo, hi]]

  const delta = axis === 'y' ? part.dy : part.dx
  const origin = axis === 'y' ? a.y : a.x

  const cuts = []
  for (const [v0, v1] of covered) {
    if (delta === 0) continue
    let t0 = (v0 - origin) / delta
    let t1 = (v1 - origin) / delta
    if (t0 > t1) [t0, t1] = [t1, t0]
    cuts.push([t0, t1])
  }
  return subtractIntervals(lo, hi, cuts)
}

function dedupe(chunk, eps) {
  const out = []
  for (const point of chunk) {
    const last = out.at(-1)
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > eps) out.push(point)
  }
  return out
}

// 把一条全局等高线路径裁成若干应在本幅印制的折线块。
// policy:
//   undefined/false  普通闭矩形裁剪（保留四条边上的沿线段，向后兼容）
//   'direction'      左/底边上的沿线段整段让给西/南邻幅
//   {left:[[v0,v1]], bottom:[[v0,v1]]}  仅在确实被邻幅共用覆盖的区间让出
export function trimPath(line, bounds, policy = false) {
  if (policy === true) policy = 'direction'
  const eps = geomTolerance(bounds)
  const chunks = []
  let active = null
  const append = piece => {
    if (!active || !piece.startsOriginal) {
      active = [piece.a]
      chunks.push(active)
    }
    active.push(piece.b)
    if (!piece.endsOriginal) active = null
  }

  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i]
    const part = clipSegmentDetailed(a, b, bounds, eps)
    if (!part) { active = null; continue }
    let ranges
    try {
      ranges = policy ? ownedIntervals(a, part, bounds, policy, eps) : [[part.lo, part.hi]]
    } catch {
      ranges = [[part.lo, part.hi]]
    }
    if (!ranges.length) { active = null; continue }
    let emitted = 0
    for (const [u0, u1] of ranges) {
      if (!(u1 > u0)) continue
      const pa = part.at(u0), pb = part.at(u1)
      if (Math.hypot(pb.x - pa.x, pb.y - pa.y) <= eps) continue
      append({ a: pa, b: pb, startsOriginal: u0 === 0, endsOriginal: u1 === 1 })
      emitted++
    }
    if (!emitted) active = null
  }

  return chunks
    .map(chunk => dedupe(chunk, eps))
    .filter(chunk => chunk.length >= 2)
}

export function clipPath(line, bounds, policy = false) {
  const chunks = trimPath(line, bounds, policy)
  // 闭合环路在原数组首尾接缝处被裁开时，把末块与首块重新接回同一块。
  if (chunks.length > 1 && line[0].id === line.at(-1).id &&
      chunks[0][0].id === line[0].id && chunks.at(-1).at(-1).id === line[0].id) {
    chunks[0] = [...chunks.pop(), ...chunks[0].slice(1)]
  }
  return chunks
}

// 按“竖共边归西幅、横共边归南幅”的绝对方向规则裁制本幅。
export function clipSheet(line, bounds) {
  return clipPath(line, bounds, 'direction')
}
export const clipLine = clipSheet
