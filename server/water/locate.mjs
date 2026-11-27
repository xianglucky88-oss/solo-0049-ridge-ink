import { cell } from '../terrain/mesh.mjs'

const epsilon = 1e-10

function weights(triangle, x, y) {
  const [a, b, c] = triangle
  const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)
  const w1 = ((b.y - c.y) * (x - c.x) + (c.x - b.x) * (y - c.y)) / denom
  const w2 = ((c.y - a.y) * (x - c.x) + (a.x - c.x) * (y - c.y)) / denom
  const w0 = 1 - w1 - w2
  return [w0, w1, w2]
}

// 枚举覆盖该地面点的全部有效三角面：格线和对角线上的点会同时属于多个面，
// 这正是判断“只在一个顶点碰头”等歧义起点所需要的信息。
export function facesAt(surface, x, y) {
  const px = x / surface.unit, py = y / surface.unit
  const found = []
  for (let row = Math.max(0, Math.ceil(py - 1 - epsilon)); row <= Math.min(surface.height - 2, Math.floor(py + epsilon)); row++) {
    for (let column = Math.max(0, Math.ceil(px - 1 - epsilon)); column <= Math.min(surface.width - 2, Math.floor(px + epsilon)); column++) {
      for (const triangle of cell(surface, column, row)) {
        if (!triangle.every(vertex => vertex.z !== null)) continue
        const w = weights(triangle, x, y)
        if (w.every(value => value >= -epsilon)) found.push({ triangle, weights: w.map(value => Math.max(0, value)) })
      }
    }
  }
  return found
}
