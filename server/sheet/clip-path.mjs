import { clipSegment } from './clip-segment.mjs'

export function clipPath(line, bounds) {
  const chunks = []
  let active = null
  for (let i = 1; i < line.length; i++) {
    const part = clipSegment(line[i - 1], line[i], bounds)
    if (!part) { active = null; continue }
    if (!active || !part.startsOriginal) {
      active = [part.a]
      chunks.push(active)
    }
    active.push(part.b)
    if (!part.endsOriginal) active = null
  }
  if (chunks.length > 1 && line[0].id === line.at(-1).id && chunks[0][0].id === line[0].id && chunks.at(-1).at(-1).id === line[0].id) {
    chunks[0] = [...chunks.pop(), ...chunks[0].slice(1)]
  }
  return chunks
}
