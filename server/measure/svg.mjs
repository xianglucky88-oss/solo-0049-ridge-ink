import { outlineLoops } from './outline.mjs'

const palette = {
  cut: { fill: '#f0c9ac', stroke: '#a65a32' },
  fill: { fill: '#c3d7cc', stroke: '#3f6f5c' },
  none: { fill: '#efe8d2', stroke: '#b3a582' },
  unknown: { fill: '#dedbd4', stroke: '#928d84' }
}

const fixed = n => Number(n.toFixed(6))

function projectOf({ left, top }) {
  return ({ x, y }) => ({ x: fixed(x - left), y: fixed(top - y) })
}

function polygonsPath(pieces, project) {
  return pieces.map(piece => piece.map((point, index) => {
    const p = project(point)
    return `${index ? 'L' : 'M'}${p.x} ${p.y}`
  }).join(' ') + ' Z').join(' ')
}

function pathOfRings(rings, project) {
  return rings.map(ring => ring.map((point, index) => {
    const p = project(point)
    return `${index ? 'L' : 'M'}${p.x} ${p.y}`
  }).join(' ') + ' Z').join(' ')
}

function zoneGroup(zone, project, { width, height, selected }) {
  const tone = palette[zone.kind]
  const point = project(zone.label)
  const fontSize = Math.max(8, Math.min(width, height) / 34)
  const state = selected == null ? '' : ` data-selected="${selected.has(zone.id)}"`
  const strokeWidth = selected == null ? 0.9 : selected.has(zone.id) ? 1.8 : 0.7
  // Fill all pieces so internal seams never show, but stroke only the merged
  // outline of the whole work area.
  const fill = polygonsPath(zone.pieces, project)
  const outline = pathOfRings(outlineLoops(zone.pieces), project)
  return `<g data-zone="${zone.id}" data-kind="${zone.kind}"${state}>
    <path d="${fill}" fill="${tone.fill}" stroke="none" fill-rule="evenodd"/>
    <path d="${outline}" fill="none" stroke="${tone.stroke}" stroke-width="${strokeWidth}"/>
    <text x="${point.x}" y="${point.y}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize.toFixed(2)}" fill="${tone.stroke}" pointer-events="none">${zone.id}</text>
  </g>`
}

function contextLayer(result, project) {
  const parts = []
  if (result.nonePieces?.length) {
    parts.push(`<path data-layer="none" d="${polygonsPath(result.nonePieces, project)}" fill="${palette.none.fill}" stroke="${palette.none.stroke}" stroke-width="0.5" fill-rule="evenodd"/>`)
  }
  if (result.unknownPieces?.length) {
    parts.push(`<path data-layer="unknown" d="${polygonsPath(result.unknownPieces, project)}" fill="${palette.unknown.fill}" stroke="${palette.unknown.stroke}" stroke-width="0.5" fill-rule="evenodd"/>`)
  }
  return parts.join('\n  ')
}

function amount(value) {
  return value.toFixed(2)
}

function rowText(zone) {
  return `${zone.id} · ${zone.kind === 'cut' ? '挖方' : '填方'} · 面积 ${amount(zone.area)} m² · 方量 ${amount(zone.volume)} m³`
}

function legend(result, bounds, zones, totals, briefing) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const fontSize = Math.max(9, Math.min(width, height) / 34)
  const lineHeight = fontSize * 1.45
  const rows = [
    `<text x="0" y="0" font-weight="bold">${briefing ? '工区交底' : '工区核量'} · ${zones.length} 片</text>`,
    ...zones.map(zone => `<text x="0" y="0" data-zone-row="${zone.id}">${rowText(zone)}</text>`),
    `<text x="0" y="0" font-weight="bold" data-total="cut">${briefing ? '所选' : ''}挖方合计 · 面积 ${amount(totals.cut.area)} m² · 方量 ${amount(totals.cut.volume)} m³</text>`,
    `<text x="0" y="0" font-weight="bold" data-total="fill">${briefing ? '所选' : ''}填方合计 · 面积 ${amount(totals.fill.area)} m² · 方量 ${amount(totals.fill.volume)} m³</text>`
  ]
  const boxWidth = Math.min(width * 0.72, 430)
  const boxHeight = lineHeight * rows.length + lineHeight
  const boxX = briefing ? 8 : width - boxWidth - 8
  const boxY = briefing ? height - boxHeight - 8 : 8
  const placed = rows.map((row, index) => row.replace('x="0" y="0"',
    `x="${boxX + 8}" y="${boxY + lineHeight * (index + 1)}"`)).join('\n    ')
  return `<g font-family="system-ui,sans-serif" font-size="${fontSize.toFixed(2)}" fill="#322e24" data-legend="1" pointer-events="none">
    <rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" fill="#fcf8eb" fill-opacity=".94" stroke="#c4b89d"/>
    ${placed}
  </g>`
}

export function drawMeasureSheet(bounds, result, options = {}) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const project = projectOf({ left: bounds.left, top: bounds.top })
  const briefing = options.mode === 'briefing'
  const chosen = options.selected ? new Set(options.selected.map(zone => zone.id)) : null
  const zones = briefing && chosen ? result.zones.filter(zone => chosen.has(zone.id)) : result.zones
  const totals = briefing && options.selected
    ? options.selected.reduce((sum, zone) => {
        sum[zone.kind].area += zone.area
        sum[zone.kind].volume += zone.volume
        return sum
      }, { cut: { area: 0, volume: 0 }, fill: { area: 0, volume: 0 } })
    : result.totals
  const zoneMarks = zones.map(zone => zoneGroup(zone, project, { width, height, selected: chosen }))
  const context = briefing ? '' : contextLayer(result, project)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixed(width)} ${fixed(height)}" role="img" data-sheet="${result.sheetId}" data-mode="${briefing ? 'briefing' : 'preview'}">
  <title>${briefing ? '工区交底图' : '挖填核量图'}</title><desc>西 ${bounds.left} 米，南 ${bounds.bottom} 米，东 ${bounds.right} 米，北 ${bounds.top} 米</desc>
  <rect width="${fixed(width)}" height="${fixed(height)}" fill="#fbf8ed"/>
  <g stroke-linejoin="round">
  ${context}
  ${zoneMarks.join('\n  ')}
  </g>
  ${legend(result, bounds, zones, totals, briefing)}
</svg>`
}
