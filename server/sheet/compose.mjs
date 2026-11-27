import { InputError } from '../http/error.mjs'
import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { sheetBounds } from './bounds.mjs'
import { contours } from './contours.mjs'
import { drawSheet } from './svg.mjs'
import { composeAtlas } from './atlas.mjs'
import { normalizeSheets, readSheetList, findSheetIndex, readBoundsSpec } from './sheets.mjs'

export function compose(input) {
  const sheetList = readSheetList(input)
  if (sheetList) return composeAtlas(input, sheetList)

  const surface = grid(input?.grid)
  const bounds = sheetBounds(surface, readBoundsSpec(input.bounds))
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const layers = contours(mesh, levels(mesh, input.interval ?? 20, input.offset ?? 0), bounds)
  const profile = samples(surface, cut)
  return { mode: 'sheet', bounds, faces: mesh.length,
    levels: layers.map(layer => ({ height: layer.height, paths: layer.paths.length, loops: layer.loops })),
    section: cut, profile, svg: drawSheet(bounds, layers) }
}

// 按同一组设置取整组或其中一张图幅的 SVG / 数据。
export function composeSheetSet(input) {
  const sheetList = readSheetList(input)
  if (sheetList) return composeAtlas(input, sheetList)
  const single = compose(input)
  return { ...single, mode: 'sheet', sheetCount: 1,
    sheets: [{ id: 'sheet-1', index: 0, label: '第 1 幅', bounds: single.bounds,
      levels: single.levels, section: single.section, profile: single.profile, svg: single.svg }],
    atlasSvg: single.svg }
}

// 从同一组设置中选出单张图幅；selector 来自 input.sheet / sheetId，
// 或 0 基的 input.sheetIndex / input.index（接受数字或数字字符串）。
export function selectSheet(result, input = {}) {
  if (!result.sheets?.length) return { index: 0, sheet: null }
  let index = -1
  const explicitIndex = input.sheetIndex ?? input.index
  if (explicitIndex != null && String(explicitIndex).trim() !== '' && /^-?\d+$/.test(String(explicitIndex).trim())) {
    index = Number(explicitIndex)
  } else {
    index = findSheetIndex(result.sheets, input.sheet ?? input.sheetId ?? input.id)
  }
  if (!Number.isInteger(index) || index < 0 || index >= result.sheets.length) {
    throw new InputError('找不到要补导的图幅，请用有效的图幅编号或标识。', 404)
  }
  return { index, sheet: result.sheets[index] }
}

export { composeAtlas } from './atlas.mjs'
export { composeAtlas as composeSheets, composeAtlas as buildAtlas } from './atlas.mjs'
export { normalizeSheets, readSheetList, findSheetIndex } from './sheets.mjs'
