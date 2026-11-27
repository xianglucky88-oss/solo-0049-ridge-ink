import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { assignLoopIds } from './loops.mjs'
import { labelFont, parseManualLabels, placeLabels } from './labels.mjs'
import { drawSheet } from './svg.mjs'

export function compose(input) {
  const surface = grid(input?.grid)
  const bounds = sheetBounds(surface, input.bounds)
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const layers = contours(mesh, levels(mesh, input.interval ?? 20, input.offset ?? 0), bounds)
  const profile = samples(surface, cut)

  assignLoopIds(layers)
  const registry = new Map()
  for (const layer of layers) for (const line of layer.lines) {
    if (line.closed) registry.set(line.loopId, { line, height: layer.height, loopId: line.loopId })
  }
  const manual = parseManualLabels(input?.labels, registry)
  const fontSize = labelFont(bounds)
  const { records, skipped } = placeLabels({ surface, bounds, layers, registry, manual, fontSize })
  const labels = records.map(({ box, ...record }) => ({ ...record,
    box: { left: box.left, bottom: box.bottom, right: box.right, top: box.top } }))

  return {
    bounds, faces: mesh.length,
    levels: layers.map(layer => ({
      height: layer.height, paths: layer.lines.length, loops: layer.loops,
      labels: labels.filter(label => label.height === layer.height).length
    })),
    labels: labels.map(({ box, ...record }) => record),
    unlabeledLoops: skipped,
    section: cut, profile,
    svg: drawSheet(bounds, layers, labels)
  }
}
