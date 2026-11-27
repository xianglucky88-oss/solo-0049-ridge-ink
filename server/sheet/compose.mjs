import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { drawSheet } from './svg.mjs'
import { budgetLayers, chooseTier, isBudget } from './budget.mjs'
import { drawingPointLimit, levelLimit } from './geometry.mjs'

export function compose(input) {
  const surface = grid(input?.grid)
  const bounds = sheetBounds(surface, input.bounds)
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const baseInterval = input.interval ?? 20
  const offset = input.offset ?? 0
  const profile = samples(surface, cut)
  const common = { bounds, faces: mesh.length, section: cut, profile }

  if (isBudget(input)) {
    const tier = chooseTier(mesh, baseInterval, offset, bounds)
    const { layers, points, interval } = budgetLayers(tier, mesh, offset, baseInterval, bounds)
    return { ...common,
      levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
      budget: { enabled: true, interval, factor: tier.factor, points,
        levelLimit, drawingPointLimit },
      svg: drawSheet(bounds, layers) }
  }

  const layers = contours(mesh, levels(mesh, baseInterval, offset), bounds)
  return { ...common,
    levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
    svg: drawSheet(bounds, layers) }
}
