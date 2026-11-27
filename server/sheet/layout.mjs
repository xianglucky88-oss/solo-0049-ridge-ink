// 兼容入口：图幅组的解析、校验与共边策略。
export {
  normalizeSheets,
  inspectSheets,
  readSheetList,
  readBoundsSpec,
  sheetIdentity,
  sheetTag,
  edgePolicies,
  findSheetIndex,
  SHEET_VERTEX_LIMIT
} from './sheets.mjs'
export { normalizeSheets as sheetSet } from './sheets.mjs'
export { normalizeSheets as parseSheets } from './sheets.mjs'
export { normalizeSheets as validateSheets } from './sheets.mjs'
export { inspectSheets as validateSheetSet } from './sheets.mjs'
export { inspectSheets as checkSheetSet } from './sheets.mjs'
export { normalizeSheets as resolveSheets } from './sheets.mjs'
export { edgePolicies as sheetEdgePolicies } from './sheets.mjs'
