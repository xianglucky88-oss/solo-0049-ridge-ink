// 线段与矩形选幅的裁剪。
// 公开的 clipSegment 保持历史返回契约：
//   { a, b, startsOriginal, endsOriginal } | null
// clipSegmentDetailed 额外给出参数区间与规范求交点，供路径修整/共边归属使用。
//
// 边界交点使用统一规范式 t=(bound-a[axis])/(b[axis]-a[axis])，使相邻图幅
// （无论该边在本幅是左边还是右边）裁同一条全局线段时得到逐位一致的线端；
// 并对“只蹭到角尖”的退化区间做长度塌缩，避免浮点误差吐出短线段。

export function geomTolerance(bounds) {
  const span = Math.max(
    Math.abs(bounds.right - bounds.left),
    Math.abs(bounds.top - bounds.bottom),
    Math.abs(bounds.left), Math.abs(bounds.right),
    Math.abs(bounds.bottom), Math.abs(bounds.top), 1
  )
  // 约为坐标量级的 1e-10，远大于浮点求交误差，又不会吞掉真实短线。
  return span * 1e-10
}

function onBound(value, bound, eps) {
  return Math.abs(value - bound) <= eps
}

export function clipSegmentDetailed(a, b, bounds, eps = geomTolerance(bounds)) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  let lo = 0
  let hi = 1

  // x 区间：L <= a.x + dx*t <= R
  if (dx === 0) {
    if (a.x < bounds.left - eps || a.x > bounds.right + eps) return null
  } else {
    const tLeft = (bounds.left - a.x) / dx
    const tRight = (bounds.right - a.x) / dx
    lo = Math.max(lo, Math.min(tLeft, tRight))
    hi = Math.min(hi, Math.max(tLeft, tRight))
  }
  // y 区间：B <= a.y + dy*t <= T
  if (dy === 0) {
    if (a.y < bounds.bottom - eps || a.y > bounds.top + eps) return null
  } else {
    const tBottom = (bounds.bottom - a.y) / dy
    const tTop = (bounds.top - a.y) / dy
    lo = Math.max(lo, Math.min(tBottom, tTop))
    hi = Math.min(hi, Math.max(tBottom, tTop))
  }

  if (!(hi >= lo)) return null

  const at = t => {
    if (t === 0) return a
    if (t === 1) return b
    let x = a.x + dx * t
    let y = a.y + dy * t
    // 吸附到精确的图幅边界常数，保证共边线端坐标完全一致。
    if (onBound(x, bounds.left, eps)) x = bounds.left
    else if (onBound(x, bounds.right, eps)) x = bounds.right
    if (onBound(y, bounds.bottom, eps)) y = bounds.bottom
    else if (onBound(y, bounds.top, eps)) y = bounds.top
    return { x, y }
  }

  const pa = at(lo)
  const pb = at(hi)

  // 塌缩角尖轻蹭 / 数值退化产生的零长度或近零“短线”。
  if (Math.hypot(pb.x - pa.x, pb.y - pa.y) <= eps) return null
  if (pa.x < bounds.left - eps || pa.x > bounds.right + eps ||
      pa.y < bounds.bottom - eps || pa.y > bounds.top + eps) return null
  if (pb.x < bounds.left - eps || pb.x > bounds.right + eps ||
      pb.y < bounds.bottom - eps || pb.y > bounds.top + eps) return null

  return {
    a: pa, b: pb,
    startsOriginal: lo === 0, endsOriginal: hi === 1,
    lo, hi, at, dx, dy
  }
}

export function clipSegment(a, b, bounds, eps) {
  const part = clipSegmentDetailed(a, b, bounds, eps)
  if (!part) return null
  return { a: part.a, b: part.b, startsOriginal: part.startsOriginal, endsOriginal: part.endsOriginal }
}
