export function clipSegment(a, b, { left, bottom, right, top }) {
  const dx = b.x - a.x, dy = b.y - a.y
  let start = 0, end = 1
  for (const [p, q] of [[-dx,a.x-left],[dx,right-a.x],[-dy,a.y-bottom],[dy,top-a.y]]) {
    if (p < 0) start = Math.max(start, q / p)
    else if (p > 0) end = Math.min(end, q / p)
    else if (q < 0) return null
  }
  if (start >= end) return null
  const at = t => t === 0 ? a : t === 1 ? b : { x: a.x + dx * t, y: a.y + dy * t }
  return { a: at(start), b: at(end), startsOriginal: start === 0, endsOriginal: end === 1 }
}
