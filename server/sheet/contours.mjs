import { InputError } from '../http/error.mjs'
import { segments } from '../contour/segments.mjs'
import { paths } from '../contour/paths.mjs'
import { clipPath } from './clip-path.mjs'
import { classifyLines } from './loops.mjs'

export function contours(mesh, levels, bounds) {
  let vertices = 0
  return levels.map(height => {
    const rawLines = paths(segments(mesh, height))
    const chunks = rawLines.map(line => clipPath(line, bounds))
    const lines = classifyLines(rawLines, chunks)
    vertices += lines.reduce((total, line) => total + line.points.length, 0)
    if (vertices > 200000) throw new InputError('选幅内路径过密，请增大等高距或缩小图幅。', 422)
    return { height, lines, loops: lines.filter(line => line.closed).length }
  })
}
