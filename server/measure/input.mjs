import { InputError } from '../http/error.mjs'

// Accept the two surfaces and the sheet selection under the common field names
// a caller might use. The canonical names are `grid`, `design` and
// `selection`, matching the baseline sheet API.
const first = (...values) => values.find(value => value != null)

export function normalize(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) return {}
  const grid = first(input.grid, input.existing, input.existingGrid, input.current, input.base, input.before)
  const design = first(input.design, input.designGrid, input.proposed, input.planned, input.target, input.after)
  const bounds = first(input.bounds, input.frame, input.extent, input.sheetBounds, input.area)
  // Keep "selection: null" distinct from "no selection key": the former is an
  // explicit empty choice, the latter simply requests the full sheet.
  const hasSelection = Object.prototype.hasOwnProperty.call(input, 'selection') || input.selected != null ||
    input.selectedZones != null || input.picked != null || input.workAreas != null
  return {
    ...input, grid, design: design ?? null, bounds: bounds ?? null,
    selection: hasSelection ? selectionOf(input) : null,
    selectionGiven: hasSelection
  }
}

function selectionOf(input) {
  const value = first(input.selection, input.selected, input.selectedZones, input.picked, input.workAreas)
  if (value == null) return null
  if (Array.isArray(value)) return { zones: value, sheetId: sheetIdOf(input) }
  if (typeof value !== 'object') return null
  return {
    ...value,
    zones: first(value.zones, value.ids, value.selected, value.zoneIds, value.pieces, value.list),
    sheetId: sheetIdOf(value) ?? sheetIdOf(input)
  }
}

function sheetIdOf(source) {
  if (source == null || typeof source !== 'object' || Array.isArray(source)) return null
  return first(source.sheetId, source.sheet, source.measurementId, source.measure, source.measureSheetId, source.id)
}

export function requireDesign(input) {
  if (input?.design == null) throw new InputError('挖填核量需要同时提供现状和设计格网。')
}

// True when the caller named a selection at all, even an empty one.
export function selectionGiven(input) {
  return normalize(input).selectionGiven
}
