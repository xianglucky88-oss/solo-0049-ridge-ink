export function drawProfile(canvas, profile, observed) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height, pad = 40
  const readings = [
    ...(observed?.segments ?? []).flatMap(segment => segment.points),
    ...(observed?.isolated ?? [])
  ]
  ctx.clearRect(0, 0, w, h)
  ctx.font = '13px sans-serif'
  if (!readings.length) {
    ctx.fillStyle = '#544837'
    ctx.fillText('测线没有有效高程读数', pad, h / 2)
    return
  }
  const low = Math.min(...readings.map(p => p.z)), high = Math.max(...readings.map(p => p.z))
  const length = profile.at(-1).distance
  const xOf = distance => pad + (w - pad - 5) * distance / length
  const yOf = z => high === low ? h / 2 : 14 + (h - 38) * (high - z) / (high - low)

  ctx.fillStyle = '#544837'
  ctx.fillText(`${high.toFixed(1)} 米`, 2, 15)
  ctx.fillText(`${low.toFixed(1)} 米`, 2, h - 24)
  ctx.fillText(`${length.toFixed(1)} 米`, w - 82, h - 3)
  ctx.fillText('0', pad, h - 3)

  // 等间距测点：保持原有约定，仅作浅色参考，不决定剖面折线。
  ctx.fillStyle = 'rgba(98,84,58,.35)'
  for (const { distance, z } of profile) if (z !== null) ctx.fillRect(xOf(distance) - .75, yOf(z) - .75, 1.5, 1.5)

  // 缺测区间：标出缺测开始与结束里程。
  ctx.strokeStyle = '#b06a52'
  ctx.fillStyle = '#b06a52'
  for (const gap of observed?.gaps ?? []) {
    const gx = xOf(gap.start), gw = Math.max(2, xOf(gap.end) - xOf(gap.start))
    ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(gx, 16); ctx.lineTo(gx, h - 18); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(gx + gw, 16); ctx.lineTo(gx + gw, h - 18); ctx.stroke()
    ctx.setLineDash([])
    if (gw > 64) {
      ctx.font = '11px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`缺测 ${gap.start.toFixed(1)}–${gap.end.toFixed(1)} 米`, gx + gw / 2, h - 22)
      ctx.textAlign = 'start'
      ctx.font = '13px sans-serif'
    }
  }

  // 有观测支撑的折线，顶点即坡折。
  ctx.strokeStyle = '#a65640'
  ctx.fillStyle = '#a65640'
  ctx.lineWidth = 2
  for (const segment of observed?.segments ?? []) {
    ctx.beginPath()
    segment.points.forEach(({ distance, z }, i) => {
      const x = xOf(distance), y = yOf(z)
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
      ctx.fillRect(x - 1.4, y - 1.4, 2.8, 2.8)
    })
    ctx.stroke()
  }

  // 孤立读数：只在一个点碰到测线的有效面，两侧缺测仍断开。
  for (const { distance, z } of observed?.isolated ?? []) {
    const x = xOf(distance), y = yOf(z)
    ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2)
    ctx.fillStyle = '#fcf8eb'; ctx.fill()
    ctx.lineWidth = 2; ctx.strokeStyle = '#a65640'; ctx.stroke()
    ctx.fillStyle = '#a65640'
  }
}
