import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { drawSheet } from './svg.mjs'
import { flood } from '../water/flood.mjs'

export function compose(input) {
  const surface = grid(input?.grid)
  const bounds = sheetBounds(surface, input.bounds)
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const water = input.water ? flood(surface, mesh, input.water) : null
  const layers = contours(mesh, levels(mesh, input.interval ?? 20, input.offset ?? 0), bounds)
  const profile = samples(surface, cut)
  return { bounds, faces: mesh.length,
    water: water && {
      level: water.level,
      entry: { x: water.entry.x, y: water.entry.y },
      faces: water.faces,
      rings: water.rings
    },
    levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
    section: cut, profile, svg: drawSheet(bounds, layers, water) }
}
