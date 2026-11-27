// 图面按等比缩放显示，窗口拉宽时两侧出现留白。点击先还原出 SVG 视口坐标，
// 留白区域不返回任何地面点，避免把空白处误当成入水位置。
export function pickGround(image, bounds, event) {
  const rect = image.getBoundingClientRect()
  const viewWidth = bounds.right - bounds.left
  const viewHeight = bounds.top - bounds.bottom
  const scale = Math.min(rect.width / viewWidth, rect.height / viewHeight)
  const renderWidth = viewWidth * scale
  const renderHeight = viewHeight * scale
  const offsetX = (rect.width - renderWidth) / 2
  const offsetY = (rect.height - renderHeight) / 2
  const px = event.clientX - rect.left - offsetX
  const py = event.clientY - rect.top - offsetY
  if (px < 0 || py < 0 || px > renderWidth || py > renderHeight) return null
  return {
    x: bounds.left + px / scale,
    y: bounds.top - py / scale
  }
}
