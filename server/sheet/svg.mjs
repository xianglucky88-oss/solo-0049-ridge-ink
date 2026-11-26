const palette = ['#446a76','#4e7563','#835a41','#883c4d','#70497e']

export function drawSheet(bounds, contours) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const fixed = n => Number(n.toFixed(6))
  const lines = contours.map(({ height: elevation, paths }, i) => {
    const d = paths.map(line => line.map(({ x, y }, j) =>
      `${j ? 'L' : 'M'}${fixed(x - bounds.left)} ${fixed(bounds.top - y)}`).join(' ')).join(' ')
    return d ? `<path data-elevation="${fixed(elevation)}" stroke="${palette[i % palette.length]}" d="${d}"/>` : ''
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img">
  <title>地形等高线</title><desc>西 ${bounds.left} 米，南 ${bounds.bottom} 米，东 ${bounds.right} 米，北 ${bounds.top} 米</desc>
  <rect width="${width}" height="${height}" fill="#fbf8ed"/>
  <g fill="none" stroke-width="${Math.hypot(width,height) / 370}" stroke-linecap="round" stroke-linejoin="round">
  ${lines.join('\n  ')}
  </g>
</svg>`
}
