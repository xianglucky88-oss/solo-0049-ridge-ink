// 兼容入口：“分幅 / tiles”命名下的同一套实现。
export { composeAtlas, composeAtlas as composeTiles, composeAtlas as buildTiles } from './atlas.mjs'
export { normalizeSheets, normalizeSheets as normalizeTiles, readSheetList } from './sheets.mjs'
export { drawAtlas, drawAtlas as drawTiles } from './svg.mjs'
