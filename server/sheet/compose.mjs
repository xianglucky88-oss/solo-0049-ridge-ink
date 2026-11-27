import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { trace } from '../profile/trace.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { drawSheet } from './svg.mjs'

export function compose(input) {
  const surface = grid(input?.grid)
  const bounds = sheetBounds(surface, input.bounds)
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const layers = contours(mesh, levels(mesh, input.interval ?? 20, input.offset ?? 0), bounds)
  const profile = samples(surface, cut)
  const observed = trace(surface, cut)
  return { bounds, faces: mesh.length, levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
    section: cut, profile, trace: observed, svg: drawSheet(bounds, layers) }
}
