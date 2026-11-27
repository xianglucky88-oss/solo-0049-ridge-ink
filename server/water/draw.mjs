const fixed = n => Number(n.toFixed(6))

// 积水范围在全格网上分析，出图时才按图幅裁剪：水在幅外绕回另一侧时，
// 进入图幅的部分仍会照常填色。
export function drawWater(bounds, water) {
  const width = bounds.right - bounds.left
  const height = bounds.top - bounds.bottom
  const sx = point => fixed(point.x - bounds.left)
  const sy = point => fixed(bounds.top - point.y)
  const paths = water.rings.map(ring => {
    const d = ring.map((point, index) => `${index ? 'L' : 'M'}${sx(point)} ${sy(point)}`).join(' ')
    return `<path data-water="${fixed(water.level)}" d="${d} Z"/>`
  }).join('\n  ')
  const marker = `<circle data-entry="1" cx="${sx(water.marker)}" cy="${sy(water.marker)}" r="${Math.max(2.5, Math.hypot(width, height) / 130)}"/>`
  return `<clipPath id="water-clip"><rect width="${width}" height="${height}"/></clipPath>
<g class="water" clip-path="url(#water-clip)" fill="#2f7ea8" fill-opacity="0.32" fill-rule="evenodd" stroke="#1d5a7d" stroke-width="${Math.max(1, Math.hypot(width, height) / 500)}" stroke-opacity="0.75">
  ${paths}
  ${marker}
</g>`
}
