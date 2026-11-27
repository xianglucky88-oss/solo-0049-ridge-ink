import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { drawSheet } from './svg.mjs'
import { measurementSheet } from '../measure/measure-sheet.mjs'
import { normalize } from '../measure/input.mjs'

// Contours, level counts and the cross-section stay available in both modes;
// they always describe the existing surface.
function dissection(surface, input, bounds) {
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const layers = contours(mesh, levels(mesh, input.interval ?? 20, input.offset ?? 0), bounds)
  return {
    faces: mesh.length,
    levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
    section: cut,
    profile: samples(surface, cut),
    contourSvg: drawSheet(bounds, layers)
  }
}

export function compose(raw) {
  const input = normalize(raw)
  const existing = grid(input?.grid)
  const bounds = sheetBounds(existing, input?.bounds)
  const base = dissection(existing, input ?? {}, bounds)
  const { contourSvg, ...shared } = base
  if (input?.design == null) return { bounds, design: false, ...shared, svg: contourSvg }

  const design = grid(input.design)
  const measured = measurementSheet(existing, design, bounds, input)
  // The full preview keeps every zone; a selection additionally yields the
  // briefing sheet, which becomes `svg` so the sheet endpoint hands back the
  // same drawing the export endpoint produces.
  const preview = measured.svg
  return {
    bounds, ...shared, ...measured,
    preview,
    svg: measured.briefing ?? preview
  }
}
