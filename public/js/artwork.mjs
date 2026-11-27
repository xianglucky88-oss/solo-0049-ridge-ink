// 服务端 SVG 以内联方式注入，高程标注才能接收指针事件并拖动。
// 拖动中的标注始终挂在所抓闭环上；落点是否合法由制图接口按同一套规则判定。

let svgNode = null
let busy = false

export function showArtwork(container, svg, { bounds, onMove, onStatus } = {}) {
  container.replaceChildren()
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  svgNode = doc.documentElement
  if (bounds) {
    svgNode.dataset.sheetLeft = bounds.left
    svgNode.dataset.sheetTop = bounds.top
  }
  container.append(svgNode)

  for (const group of svgNode.querySelectorAll('g.elevation')) {
    const loopId = group.dataset.loopId
    group.classList.add('draggable')
    group.tabIndex = 0
    group.setAttribute('role', 'button')
    group.setAttribute('aria-label', `高程 ${group.querySelector('text').dataset.elevation} 米标注，可拖动调整位置`)

    group.addEventListener('pointerdown', event => {
      if (busy || event.button !== 0) return
      event.preventDefault()
      group.setPointerCapture(event.pointerId)
      group.classList.add('dragging')
      const label = group.querySelector('text')
      const start = toMap(svgNode, event)
      const origin = { x: Number(label.getAttribute('x')), y: Number(label.getAttribute('y')) }
      const bounds = svgNode.viewBox.baseVal

      const move = pointer => {
        const point = toMap(svgNode, pointer)
        const x = clamp(origin.x + point.x - start.x, bounds.x, bounds.x + bounds.width)
        const y = clamp(origin.y + point.y - start.y, bounds.y, bounds.y + bounds.height)
        place(group, x, y)
      }
      const up = async pointer => {
        group.classList.remove('dragging')
        group.removeEventListener('pointermove', move)
        group.removeEventListener('pointerup', up)
        group.removeEventListener('pointercancel', cancel)
        const point = toMap(svgNode, pointer)
        const drop = toSheet(svgNode, point)
        busy = true
        try {
          await onMove?.(loopId, drop)
        } catch (error) {
          onStatus?.(error.message)
        } finally {
          busy = false
        }
      }
      const cancel = () => {
        place(group, origin.x, origin.y)
        group.classList.remove('dragging')
        group.removeEventListener('pointermove', move)
        group.removeEventListener('pointerup', up)
        group.removeEventListener('pointercancel', cancel)
      }
      group.addEventListener('pointermove', move)
      group.addEventListener('pointerup', up)
      group.addEventListener('pointercancel', cancel)
    })

    group.addEventListener('keydown', event => {
      if (busy || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      const label = group.querySelector('text')
      const fontSize = Number(label.getAttribute('font-size'))
      const step = event.key === 'ArrowUp' || event.key === 'ArrowDown'
        ? { x: 0, y: event.key === 'ArrowUp' ? -fontSize : fontSize }
        : { x: event.key === 'ArrowLeft' ? -fontSize : fontSize, y: 0 }
      const point = { x: Number(label.getAttribute('x')) + step.x, y: Number(label.getAttribute('y')) + step.y }
      const drop = toSheet(svgNode, point)
      busy = true
      Promise.resolve(onMove?.(loopId, drop))
        .catch(error => onStatus?.(error.message))
        .finally(() => { busy = false })
    })
  }
}

function place(group, x, y) {
  const label = group.querySelector('text')
  const hit = group.querySelector('rect')
  label.setAttribute('x', fixed(x))
  label.setAttribute('y', fixed(y))
  hit.setAttribute('x', fixed(x - Number(hit.getAttribute('width')) / 2))
  hit.setAttribute('y', fixed(y - Number(hit.getAttribute('height')) / 2))
}

const fixed = n => Number(n.toFixed(6))
const clamp = (n, low, high) => Math.max(low, Math.min(high, n))

// 屏幕坐标 -> SVG viewBox 坐标
function toMap(svg, event) {
  const point = new DOMPoint(event.clientX, event.clientY)
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const mapped = point.matrixTransform(matrix.inverse())
  return { x: mapped.x, y: mapped.y }
}

// SVG 坐标 -> 制图坐标（x 从西向东，y 从北向南）
function toSheet(svg, mapPoint) {
  const box = svg.viewBox.baseVal
  const sheetX = svg.dataset.sheetLeft ? Number(svg.dataset.sheetLeft) : 0
  const sheetTop = svg.dataset.sheetTop ? Number(svg.dataset.sheetTop) : 0
  return { x: sheetX + mapPoint.x, y: sheetTop - mapPoint.y }
}
