import { InputError } from '../http/error.mjs'
import { grid } from '../terrain/grid.mjs'
import { triangles } from '../terrain/mesh.mjs'
import { levels } from '../contour/levels.mjs'
import { segments } from '../contour/segments.mjs'
import { paths as connectPaths } from '../contour/paths.mjs'
import { section } from '../profile/section.mjs'
import { samples } from '../profile/samples.mjs'
import { clipPath } from './clip-path.mjs'
import { drawSheet, drawAtlas } from './svg.mjs'
import { normalizeSheets, edgePolicies, sheetTag, SHEET_VERTEX_LIMIT } from './sheets.mjs'

// 同一份格网 + 分级设置只提取一次全局路径，再按各幅边界与共边归属裁剪，
// 从而保证相邻图幅线端来自同一条全局线段的同一个规范交点。
export function composeAtlas(input, list) {
  const surface = grid(input?.grid)
  const sheets = normalizeSheets(surface, list)
  const cut = section(surface, input.section)
  const mesh = triangles(surface)
  const heights = levels(mesh, input.interval ?? 20, input.offset ?? 0)

  const policies = edgePolicies(sheets, surface)

  const globalLayers = heights.map(height => ({
    height,
    lines: connectPaths(segments(mesh, height))
  }))

  const compiled = sheets.map((sheet, sheetIndex) => {
    const policy = policies[sheetIndex]
    let vertices = 0
    let exceeded = false
    const layers = []
    for (const { height, lines } of globalLayers) {
      if (vertices > SHEET_VERTEX_LIMIT) { exceeded = true; break }
      const clipped = lines.flatMap(line => clipPath(line, sheet.bounds, policy))
      const layerVertices = clipped.reduce((total, line) => total + line.length, 0)
      vertices += layerVertices
      layers.push({
        height,
        paths: clipped,
        vertices: layerVertices,
        loops: clipped.filter(line => line[0]?.id && line[0].id === line.at(-1).id).length
      })
    }
    return { sheet, layers, vertices, exceeded: exceeded || vertices > SHEET_VERTEX_LIMIT }
  })

  const overages = compiled
    .filter(item => item.vertices > SHEET_VERTEX_LIMIT)
    .map(item => ({
      kind: 'density',
      index: item.sheet.index,
      id: item.sheet.id,
      label: item.sheet.label,
      vertices: item.vertices,
      limit: SHEET_VERTEX_LIMIT,
      message: `${sheetTag(item.sheet)}路径过密（约 ${item.vertices} 个路径顶点，上限 ${SHEET_VERTEX_LIMIT}），请增大等高距或缩小该幅。`
    }))
  if (overages.length) {
    const error = new InputError(overages.map(o => o.message).join(' '), 422)
    error.issues = overages
    throw error
  }

  const union = sheets.reduce((u, s) => ({
    left: Math.min(u.left, s.bounds.left),
    bottom: Math.min(u.bottom, s.bounds.bottom),
    right: Math.max(u.right, s.bounds.right),
    top: Math.max(u.top, s.bounds.top)
  }), { left: Infinity, bottom: Infinity, right: -Infinity, top: -Infinity })

  const sheetViews = compiled.map(({ sheet, layers, vertices }) => {
    const levelSummary = layers.map(layer => ({
      height: layer.height,
      paths: layer.paths.length,
      loops: layer.loops,
      vertices: layer.vertices
    }))
    const view = {
      id: sheet.id,
      name: sheet.name,
      index: sheet.index,
      label: sheet.label,
      customKey: sheet.customKey,
      bounds: sheet.bounds,
      vertices,
      vertexCount: vertices,
      limit: SHEET_VERTEX_LIMIT,
      pathCount: levelSummary.reduce((n, l) => n + l.paths, 0),
      levels: levelSummary,
      contours: layers,
      svg: ''
    }
    view.svg = drawSheet(sheet.bounds, layers)
    return view
  })

  const atlasSvg = drawAtlas(union, sheetViews.map(v => ({
    id: v.id, label: v.label, bounds: v.bounds, contours: v.contours
  })))

  const levelTotals = heights.map((height, i) => ({
    height,
    paths: sheetViews.reduce((n, v) => n + v.levels[i].paths, 0),
    loops: sheetViews.reduce((n, v) => n + v.levels[i].loops, 0)
  }))

  const profile = samples(surface, cut)
  const result = {
    mode: 'atlas',
    sheetCount: sheetViews.length,
    count: sheetViews.length,
    bounds: union,
    faces: mesh.length,
    levels: levelTotals,
    section: cut,
    profile,
    sheets: sheetViews,
    atlasSvg,
    groupSvg: atlasSvg,
    allSvg: atlasSvg,
    svg: atlasSvg
  }
  result.atlas = { svg: atlasSvg, bounds: union, sheetCount: sheetViews.length }
  return result
}
