import { measure, totalsOf, validateSelection } from './measure.mjs'
import { drawMeasureSheet } from './svg.mjs'

import { InputError } from '../http/error.mjs'

const fixed = n => Number(n.toFixed(6))

function money(values) {
  return { area: fixed(values.area), volume: fixed(values.volume) }
}

// Build the measurement preview and, when a valid selection is supplied, the
// briefing sheet for exactly those zones. `requireSelection` (export) turns a
// missing, empty or stale selection into an error.
export function measurementSheet(existing, design, bounds, input = {}, options = {}) {
  const result = measure(existing, design, bounds)
  const width = fixed(bounds.right - bounds.left)
  const height = fixed(bounds.top - bounds.bottom)
  const response = {
    mode: 'measure',
    design: true,
    bounds,
    sheetId: result.sheetId,
    viewBox: { width, height },
    zones: result.zones.map(({ id, kind, area, volume, label }) => ({
      id, kind, area: fixed(area), volume: fixed(volume), label
    })),
    none: { area: fixed(result.noneArea) },
    unknown: { area: fixed(result.unknownArea) },
    totals: { cut: money(result.totals.cut), fill: money(result.totals.fill) },
    svg: drawMeasureSheet(bounds, result, { mode: 'preview' })
  }

  if (options.requireSelection && input.selection == null) {
    throw new InputError('请先选择工区再导出交底图。')
  }
  if (input.selection != null) {
    let selected
    try {
      selected = validateSelection(input.selection, result.sheetId, result.zones)
    } catch (error) {
      // The preview sheet stays usable; a bad or stale selection only blocks
      // the briefing. Export asks for the briefing outright, so it hard-fails.
      if (options.requireSelection) throw error
      response.selectionError = error.message
      return response
    }
    const totals = totalsOf(selected)
    response.selection = {
      sheetId: result.sheetId,
      zones: selected.map(zone => zone.id),
      totals: { cut: money(totals.cut), fill: money(totals.fill) }
    }
    response.briefing = drawMeasureSheet(bounds, result, { mode: 'briefing', selected })
  }
  return response
}
