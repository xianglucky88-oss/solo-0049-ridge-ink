export function drawProfile(canvas, profile) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width, h = canvas.height, pad = 40
  const measured = profile.filter(point => point.z !== null)
  ctx.clearRect(0, 0, w, h)
  ctx.font = '13px sans-serif'; ctx.fillStyle = '#544837'
  if (!measured.length) { ctx.fillText('测线没有有效采样点', pad, h / 2); return }
  const low = Math.min(...measured.map(p => p.z)), high = Math.max(...measured.map(p => p.z))
  const length = profile.at(-1).distance
  ctx.fillText(`${high.toFixed(1)} 米`, 2, 15)
  ctx.fillText(`${low.toFixed(1)} 米`, 2, h - 24)
  ctx.fillText(`${length.toFixed(1)} 米`, w - 82, h - 3)
  ctx.fillText('0', pad, h - 3)
  ctx.strokeStyle = '#a65640'; ctx.lineWidth = 2; ctx.beginPath()
  let connected = false
  for (const { distance, z } of profile) {
    if (z === null) { connected = false; continue }
    const x = pad + (w - pad - 5) * distance / length
    const y = high === low ? h / 2 : 14 + (h - 38) * (high - z) / (high - low)
    if (connected) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    ctx.fillRect(x - 1, y - 1, 2, 2)
    connected = true
  }
  ctx.stroke()
}
