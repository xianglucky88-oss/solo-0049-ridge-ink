import { readJson } from './http/read-json.mjs'
import { InputError } from './http/error.mjs'
import { demo } from './terrain/demo.mjs'
import { compose } from './sheet/compose.mjs'

export async function route(request, operation) {
  if (operation === 'demo' && request.method === 'GET') return { body: demo() }
  if (['sheet','export'].includes(operation) && request.method === 'POST') {
    const sheet = compose(await readJson(request, 200000))
    return operation === 'export'
      ? { type: 'image/svg+xml; charset=utf-8', filename: 'ridge-sheet.svg', body: sheet.svg }
      : { body: sheet }
  }
  throw new InputError('找不到制图入口。', 404)
}
