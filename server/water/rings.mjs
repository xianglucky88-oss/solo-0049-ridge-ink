const epsilon = 1e-10

function crossingKey(a, b) {
  return a.id < b.id ? `e${a.id}:${b.id}` : `e${b.id}:${a.id}`
}

// 单个湿面在水位以下的截多边形，顶点沿三角边界有序。平顶点（z===level）
// 保留为顶点但不计为入水，保证窄坎处两片低地不会被填成一片。
export function wetPolygon(triangle, level) {
  const points = []
  for (let i = 0; i < 3; i++) {
    const a = triangle[i], b = triangle[(i + 1) % 3]
    if (a.z < level && b.z >= level) {
      const f = (level - a.z) / (b.z - a.z)
      points.push({ key: crossingKey(a, b), x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    }
    if (b.z < level && a.z >= level) {
      const f = (level - b.z) / (a.z - b.z)
      points.push({ key: crossingKey(a, b), x: b.x + (a.x - b.x) * f, y: b.y + (a.y - b.y) * f })
    }
    if (b.z < level) points.push({ key: `v${b.id}`, x: b.x, y: b.y })
  }
  const ordered = []
  for (const point of points) if (!ordered.some(p => p.key === point.key)) ordered.push(point)
  return ordered.length >= 3 ? ordered : null
}

// 合并同一连通分量内各湿面的截多边形：内部共享边成对出现后溶解，
// 剩下的单边沿节点接成外环与内环。
export function componentRings(mesh, faces, level) {
  const count = new Map()
  const coordinates = new Map()
  for (const faceIndex of faces) {
    const polygon = wetPolygon(mesh[faceIndex], level)
    if (!polygon) continue
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length]
      if (Math.hypot(a.x - b.x, a.y - b.y) <= epsilon) continue
      const key = a.key < b.key ? `${a.key}|${b.key}` : `${b.key}|${a.key}`
      count.set(key, (count.get(key) ?? 0) + 1)
      coordinates.set(a.key, { x: a.x, y: a.y })
      coordinates.set(b.key, { x: b.x, y: b.y })
    }
  }
  const nodeEdges = new Map()
  for (const [key, times] of count) {
    if (times !== 1) continue
    const [ka, kb] = key.split('|')
    for (const [from, to] of [[ka, kb], [kb, ka]]) {
      if (!nodeEdges.has(from)) nodeEdges.set(from, [])
      nodeEdges.get(from).push(to)
    }
  }
  const used = new Set()
  const rings = []
  for (const start of nodeEdges.keys()) {
    const first = nodeEdges.get(start).find(to => !used.has(`${start}>${to}`))
    if (first === undefined) continue
    const ring = [coordinates.get(start)]
    let prev = start, current = first
    while (current !== start && current !== undefined) {
      // 无向边一旦走过，两个方向同时标记，避免同一边界被反向再走一遍
      used.add(`${prev}>${current}`).add(`${current}>${prev}`)
      ring.push(coordinates.get(current))
      const next = nodeEdges.get(current)?.find(to => to !== prev && !used.has(`${current}>${to}`))
        ?? nodeEdges.get(current)?.find(to => !used.has(`${current}>${to}`))
      prev = current
      current = next
    }
    if (current === start) used.add(`${prev}>${start}`).add(`${start}>${prev}`)
    if (ring.length >= 3) rings.push(ring)
  }
  return rings
}
