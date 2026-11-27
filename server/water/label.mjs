function edgeKey(a, b) {
  return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`
}

// 湿面：至少一个顶点严格低于水位。湿面之间只有沿共享边、且该边存在
// 低于水位的一段（至少一个端点 z < level）时才相通；仅共顶点、窄坎平齐
// 水位、缺测面隔断都不会产生连通。
export function faceId(triangle) {
  return triangle.map(vertex => vertex.id).join(':')
}

export function wetComponents(mesh, level) {
  const wet = mesh.map(triangle => triangle.some(vertex => vertex.z < level))
  const edgeFaces = new Map()
  mesh.forEach((triangle, faceIndex) => {
    if (!wet[faceIndex]) return
    for (let i = 0; i < 3; i++) {
      const key = edgeKey(triangle[i], triangle[(i + 1) % 3])
      if (!edgeFaces.has(key)) edgeFaces.set(key, [])
      edgeFaces.get(key).push(faceIndex)
    }
  })
  const component = new Int32Array(mesh.length).fill(-1)
  const groups = []
  for (let start = 0; start < mesh.length; start++) {
    if (!wet[start] || component[start] !== -1) continue
    const id = groups.length
    const stack = [start]
    const faces = []
    component[start] = id
    while (stack.length) {
      const faceIndex = stack.pop()
      faces.push(faceIndex)
      const triangle = mesh[faceIndex]
      for (let i = 0; i < 3; i++) {
        const a = triangle[i], b = triangle[(i + 1) % 3]
        if (!(a.z < level || b.z < level)) continue
        for (const neighbor of edgeFaces.get(edgeKey(a, b)) ?? []) {
          if (wet[neighbor] && component[neighbor] === -1) {
            component[neighbor] = id
            stack.push(neighbor)
          }
        }
      }
    }
    groups.push(faces)
  }
  return { wet, component, groups }
}
