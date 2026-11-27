// 留白只中断带标注的那一圈：裁掉该圈落入字框的线段，其他圈保持完整。

// 返回线段 a-b 落在框外的子段（0、1 或 2 段），点为框边交点时保留。
function outsideParts(a, b, box) {
  const dx = b.x - a.x, dy = b.y - a.y
  let start = 0, end = 1
  for (const [p, q] of [[-dx, a.x - box.left], [dx, box.right - a.x], [-dy, a.y - box.bottom], [dy, box.top - a.y]]) {
    if (p < 0) start = Math.max(start, q / p)
    else if (p > 0) end = Math.min(end, q / p)
    else if (q < 0) return [[a, b]]
  }
  if (start >= end) return [[a, b]]
  const at = t => ({ x: a.x + dx * t, y: a.y + dy * t })
  const parts = []
  if (start > 0) parts.push([a, at(start)])
  if (end < 1) parts.push([at(end), b])
  return parts
}

export function cutGap(line, box) {
  const pieces = []
  let active = null
  for (let i = 1; i < line.points.length; i++) {
    for (const [partA, partB] of outsideParts(line.points[i - 1], line.points[i], box)) {
      if (!active || active.at(-1).x !== partA.x || active.at(-1).y !== partA.y) {
        active = [partA]
        pieces.push(active)
      }
      active.push(partB)
    }
  }
  return pieces.filter(piece => piece.length > 1)
}
