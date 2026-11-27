const palette = ['#446a76','#4e7563','#835a41','#883c4d','#70497e']
const fixed = n => Number(n.toFixed(6))

export function escapeXml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

// 生成一幅图内部的等高线 <path> 标记；坐标换算与历史输出保持一致。
export function pathMarkup(bounds, contours) {
  return contours.map(({ height: elevation, paths }, i) => {
    const d = paths.map(line => line.map(({ x, y }, j) =>
      `${j ? 'L' : 'M'}${fixed(x - bounds.left)} ${fixed(bounds.top - y)}`).join(' ')).join(' ')
    return d ? `<path data-elevation="${fixed(elevation)}" stroke="${palette[i % palette.length]}" d="${d}"/>` : ''
  })
}

export function sheetStrokeWidth(bounds) {
  return Math.hypot(bounds.right - bounds.left, bounds.top - bounds.bottom) / 370
}

export function drawSheet(bounds, contours) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const lines = pathMarkup(bounds, contours)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">
  <title>地形等高线</title><desc>西 ${bounds.left} 米，南 ${bounds.bottom} 米，东 ${bounds.right} 米，北 ${bounds.top} 米</desc>
  <rect width="${width}" height="${height}" fill="#fbf8ed"/>
  <g fill="none" stroke-width="${sheetStrokeWidth(bounds)}" stroke-linecap="round" stroke-linejoin="round">
  ${lines.join('\n  ')}
  </g>
</svg>`
}

// 整组拼版：所有路径直接使用相对整组外接框的统一制图坐标，
// 这样共边处两侧线端在同一个 SVG 坐标系里输出完全相同的坐标串。
// views: [{ id, label, bounds, contours }]
export function drawAtlas(union, views) {
  const width = union.right - union.left
  const height = union.top - union.bottom
  const groups = views.map((view, index) => {
    const b = view.bounds
    const w = b.right - b.left
    const h = b.top - b.bottom
    const rx = fixed(b.left - union.left)
    const ry = fixed(union.top - b.top)
    // 用整组外接框做换算：d 中坐标即“拼在一起”后的统一坐标。
    const lines = pathMarkup(union, view.contours).filter(Boolean).join('\n    ')
    const label = escapeXml(view.label || view.id || `sheet-${index + 1}`)
    const fontSize = fixed(Math.max(12, Math.hypot(w, h) / 42))
    const labelX = fixed(b.right - union.left - 8)
    const labelY = fixed(union.top - b.top + fontSize + 4)
    return `  <g class="atlas-sheet" data-sheet-id="${escapeXml(view.id)}" data-sheet-index="${index}">
    <title>${label}</title>
    <rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="#fbf8ed"/>
    <g fill="none" stroke-width="${sheetStrokeWidth(b)}" stroke-linecap="round" stroke-linejoin="round">
    ${lines}
    </g>
    <rect x="${rx}" y="${ry}" width="${w}" height="${h}" fill="none" stroke="#b6a98a" stroke-width="${fixed(Math.max(0.6, sheetStrokeWidth(b) / 2))}"/>
    <text x="${labelX}" y="${labelY}" text-anchor="end" font-size="${fontSize}" fill="#8a7a5c">${label}</text>
  </g>`
  })
  const desc = views.map(v => `${escapeXml(v.label || v.id)}: 西${v.bounds.left} 南${v.bounds.bottom} 东${v.bounds.right} 北${v.bounds.top}`).join('；')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fixed(width)} ${fixed(height)}" role="img">
  <title>岭线排图 · 整组图幅</title><desc>${desc}</desc>
  <rect width="${fixed(width)}" height="${fixed(height)}" fill="#f3edda"/>
  ${groups.join('\n')}
</svg>`
}
