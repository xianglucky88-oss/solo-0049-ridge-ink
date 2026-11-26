export function cell(surface, x, y) {
  const index = y * surface.width + x
  const [a, b, c, d] = [index, index + 1, index + surface.width, index + surface.width + 1]
    .map(i => surface.vertices[i])
  return [[a, b, d], [a, d, c]]
}

export function triangles(surface) {
  const mesh = []
  for (let y = 0; y < surface.height - 1; y++) {
    for (let x = 0; x < surface.width - 1; x++) {
      for (const triangle of cell(surface, x, y)) {
        if (triangle.every(vertex => vertex.z !== null)) mesh.push(triangle)
      }
    }
  }
  return mesh
}
