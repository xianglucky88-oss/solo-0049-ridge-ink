// 兼容入口：“整组图幅 / group”命名。
export { composeAtlas, composeAtlas as composeGroup, composeAtlas as buildGroup } from './atlas.mjs'
export { drawAtlas, drawAtlas as drawGroupSvg } from './svg.mjs'
export { normalizeSheets, readSheetList } from './sheets.mjs'
