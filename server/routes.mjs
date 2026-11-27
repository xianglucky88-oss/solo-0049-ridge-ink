import { readJson } from './http/read-json.mjs'
import { InputError } from './http/error.mjs'
import { demo } from './terrain/demo.mjs'
import { compose } from './sheet/compose.mjs'
import { briefing } from './measure/briefing.mjs'
import { selectionGiven } from './measure/input.mjs'

export async function route(request, operation) {
  if (operation === 'demo' && request.method === 'GET') return { body: demo() }
  if (['sheet','export'].includes(operation) && request.method === 'POST') {
    const input = await readJson(request, 200000)
    if (operation !== 'export') return { body: compose(input) }

    // Naming a selection asks for a briefing sheet, so an empty or stale choice
    // is reported rather than silently downloading something else. Without a
    // selection the complete sheet is exported as before.
    if (selectionGiven(input)) {
      const result = briefing(input)
      return { type: 'image/svg+xml; charset=utf-8', filename: 'ridge-briefing.svg', body: result.briefing }
    }
    const sheet = compose(input)
    return {
      type: 'image/svg+xml; charset=utf-8',
      filename: sheet.design ? 'ridge-measure.svg' : 'ridge-sheet.svg',
      body: sheet.svg
    }
  }
  throw new InputError('找不到制图入口。', 404)
}
