import { grid } from '../terrain/grid.mjs'
import { sheetBounds } from '../sheet/bounds.mjs'
import { measurementSheet } from './measure-sheet.mjs'
import { normalize } from './input.mjs'
import { InputError } from '../http/error.mjs'

export function designInput(raw) {
  const input = normalize(raw)
  if (input.grid == null) throw new InputError('挖填核量需要现状格网。')
  if (input.design == null) throw new InputError('挖填核量需要同时提供现状和设计格网。')
  const existing = grid(input.grid)
  const design = grid(input.design)
  const bounds = sheetBounds(existing, input.bounds)
  return { input, existing, design, bounds }
}

// Full measurement sheet: every zone, no selection required.
export function measurement(raw) {
  const { existing, design, bounds } = designInput(raw)
  return measurementSheet(existing, design, bounds, {})
}

// Briefing sheet for the selected zones. A missing, empty or stale selection is
// an error here because this endpoint hands work to a crew.
export function briefing(raw) {
  const { input, existing, design, bounds } = designInput(raw)
  return measurementSheet(existing, design, bounds, input, { requireSelection: true })
}
