export const EPS = 1e-9

export function signedArea(polygon) {
  let total = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}

export function area(polygon) {
  return Math.abs(signedArea(polygon))
}

export function centroid(polygon) {
  let cross = 0, x = 0, y = 0
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length]
    const weight = a.x * b.y - b.x * a.y
    cross += weight
    x += (a.x + b.x) * weight
    y += (a.y + b.y) * weight
  }
  if (Math.abs(cross) < 1e-15) {
    const sum = polygon.reduce((point, total) => ({ x: point.x + total.x, y: point.y + total.y }), { x: 0, y: 0 })
    return { x: sum.x / polygon.length, y: sum.y / polygon.length }
  }
  return { x: x / (3 * cross), y: y / (3 * cross) }
}

export function orient(polygon) {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : polygon
}

// Split a convex polygon by a linear field. Returns the part where the field is
// negative, the part where it is positive, and the untouched polygon when the
// field is flat at zero across it. Points on the split line join both parts.
export function splitLinear(polygon, valueAt, eps = EPS) {
  const n = polygon.length
  const values = polygon.map(valueAt)
  let low = false, high = false
  for (const value of values) {
    if (value < -eps) low = true
    if (value > eps) high = true
  }
  if (!low && !high) return { negative: null, positive: null, zero: polygon }
  if (!low) return { negative: null, positive: polygon, zero: null }
  if (!high) return { negative: polygon, positive: null, zero: null }

  const negative = [], positive = []
  for (let i = 0; i < n; i++) {
    const a = polygon[i], b = polygon[(i + 1) % n]
    const va = values[i], vb = values[(i + 1) % n]
    if (va <= eps) negative.push(a)
    if (va >= -eps) positive.push(a)
    if (va < -eps && vb > eps || va > eps && vb < -eps) {
      const t = va / (va - vb)
      const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      negative.push(point)
      positive.push(point)
    }
  }
  return {
    negative: negative.length >= 3 ? negative : null,
    positive: positive.length >= 3 ? positive : null,
    zero: null
  }
}
