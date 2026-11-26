export function paths(segments) {
  const nodes = new Map()
  const edges = segments.map(pair => ({ pair, used: false }))
  for (const edge of edges) for (const point of edge.pair) {
    if (!nodes.has(point.id)) nodes.set(point.id, [])
    nodes.get(point.id).push(edge)
  }
  function follow(point, edge) {
    const line = [point]
    while (edge && !edge.used) {
      edge.used = true
      point = edge.pair.find(p => p.id !== point.id)
      line.push(point)
      const members = nodes.get(point.id)
      edge = members.length === 2 && members.find(member => !member.used)
    }
    return line
  }
  const result = []
  for (const [id, adjacent] of nodes) {
    if (adjacent.length === 2) continue
    for (const edge of adjacent) if (!edge.used) result.push(follow(edge.pair.find(point => point.id === id), edge))
  }
  for (const edge of edges) if (!edge.used) result.push(follow(edge.pair[0], edge))
  return result
}
