import { InputError } from '../http/error.mjs'
import { segments } from '../contour/segments.mjs'
import { paths } from '../contour/paths.mjs'
import { clipPath } from './clip-path.mjs'

export function contours(mesh, levels, bounds) {
  let vertices = 0
  return levels.map(height => {
    const lines = paths(segments(mesh, height)).flatMap(line => clipPath(line, bounds))
    vertices += lines.reduce((total, line) => total + line.length, 0)
    if (vertices > 200000) throw new InputError('选幅内路径过密，请增大等高距或缩小图幅。', 422)
    return { height, paths: lines, loops: lines.filter(line => line[0].id && line[0].id === line.at(-1).id).length }
  })
}
