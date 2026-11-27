import { readJson } from './http/read-json.mjs'
import { InputError } from './http/error.mjs'
import { demo } from './terrain/demo.mjs'
import { compose, composeSheetSet, selectSheet } from './sheet/compose.mjs'

const SVG_TYPE = 'image/svg+xml; charset=utf-8'

function safeFilenamePart(value) {
  return String(value ?? 'sheet').replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 60) || 'sheet'
}

function hasSelector(input, param) {
  if (param != null) return true
  const scalar = v => v != null && (typeof v === 'string' || typeof v === 'number')
  return scalar(input.sheet) || scalar(input.sheetId) || scalar(input.id) ||
    input.sheetIndex != null || input.index != null
}

function svgResponse(svg, filename) {
  return { type: SVG_TYPE, filename, body: svg }
}

function exportResponse(input, pathSelector) {
  const payload = pathSelector != null && input.sheet == null && input.sheetId == null
    ? { ...input, sheet: pathSelector }
    : input
  const result = composeSheetSet(payload)
  if (hasSelector(payload, pathSelector)) {
    const { index, sheet } = selectSheet(result, payload)
    return svgResponse(sheet.svg, `ridge-sheet-${index + 1}-${safeFilenamePart(sheet.id)}.svg`)
  }
  return svgResponse(result.svg, result.mode === 'atlas' ? 'ridge-atlas.svg' : 'ridge-sheet.svg')
}

export async function route(request, operation) {
  const [op, paramRaw] = operation.split('/')
  const param = paramRaw ? decodeURIComponent(paramRaw) : undefined

  if (op === 'demo' && request.method === 'GET') return { body: demo() }

  if (['sheet', 'sheets', 'atlas', 'sheet-set', 'group'].includes(op) && request.method === 'POST') {
    const input = await readJson(request, 200000)
    const result = compose(input)
    // POST /sheet/<selector> 或 body 带选择器：按同一组设置只给某一张图幅。
    if (result.mode === 'atlas' && hasSelector(input, param)) {
      const { index, sheet } = selectSheet(result, param != null ? { ...input, sheet: param } : input)
      return { body: { ...result, selectedIndex: index, selectedSheet: sheet, ...sheet } }
    }
    return { body: result }
  }

  if (['export', 'export-all', 'export-group', 'export-sheet', 'export-one'].includes(op) && request.method === 'POST') {
    const input = await readJson(request, 200000)
    if (op === 'export-all' || op === 'export-group') {
      const result = compose(input)
      return svgResponse(result.svg, result.mode === 'atlas' ? 'ridge-atlas.svg' : 'ridge-sheet.svg')
    }
    if (op === 'export-sheet' || op === 'export-one' || param) {
      const result = composeSheetSet(input)
      const selectorInput = param ? { ...input, sheet: input.sheet ?? param } : input
      const { index, sheet } = selectSheet(result, selectorInput)
      return svgResponse(sheet.svg, `ridge-sheet-${index + 1}-${safeFilenamePart(sheet.id)}.svg`)
    }
    return exportResponse(input, null)
  }

  throw new InputError('找不到制图入口。', 404)
}
