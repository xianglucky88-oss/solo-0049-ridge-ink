import { formatHeight, labelFont } from './labels.mjs'
import { cutGap } from './gap.mjs'

const palette = ['#446a76','#4e7563','#835a41','#883c4d','#70497e']

export function drawSheet(bounds, contours, labels = []) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const fontSize = labelFont(bounds)
  const fixed = n => Number(n.toFixed(6))
  const toX = x => fixed(x - bounds.left)
  const toY = y => fixed(bounds.top - y)
  const byLoop = new Map(labels.map(label => [label.loopId, label]))

  const subpath = points => points.map(({ x, y }, j) =>
    `${j ? 'L' : 'M'}${toX(x)} ${toY(y)}`).join(' ')

  const lines = contours.map(({ height: elevation, lines }, i) => {
    const d = lines.flatMap(line => {
      const label = line.loopId ? byLoop.get(line.loopId) : null
      return label ? cutGap(line, label.box).map(subpath) : [subpath(line.points)]
    }).filter(Boolean).join(' ')
    return d ? `<path data-elevation="${fixed(elevation)}" stroke="${palette[i % palette.length]}" d="${d}"/>` : ''
  })

  const texts = labels.map(label => {
    const x = toX(label.x), y = toY(label.y)
    const boxWidth = fixed(label.box.right - label.box.left)
    const boxHeight = fixed(label.box.top - label.box.bottom)
    const text = formatHeight(label.height)
    const hit = `<rect class="label-hit" data-loop-id="${label.loopId}" x="${fixed(x - boxWidth / 2)}" y="${fixed(y - boxHeight / 2)}" width="${boxWidth}" height="${boxHeight}"/>`
    const word = `<text class="elevation-label" data-loop-id="${label.loopId}" data-elevation="${fixed(label.height)}" x="${x}" y="${y}" font-size="${fixed(fontSize)}">${text}</text>`
    return `  <g class="elevation" data-loop-id="${label.loopId}">${hit}${word}</g>`
  }).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">
  <title>地形等高线</title><desc>西 ${bounds.left} 米，南 ${bounds.bottom} 米，东 ${bounds.right} 米，北 ${bounds.top} 米</desc>
  <rect width="${width}" height="${height}" fill="#fbf8ed"/>
  <g fill="none" stroke-width="${Math.hypot(width,height) / 370}" stroke-linecap="round" stroke-linejoin="round">
  ${lines.join('\n  ')}
  </g>
  <g class="elevation-labels" font-family="system-ui, sans-serif" text-anchor="middle" dominant-baseline="central" fill="#3a3128">
${texts}
  </g>
</svg>`
}
