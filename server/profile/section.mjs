import { InputError } from '../http/error.mjs'

export function section(surface, input) {
  const { x1, y1, x2, y2, count } = input ?? {
    x1: surface.originX, y1: (surface.originY + surface.top) / 2,
    x2: surface.right, y2: (surface.originY + surface.top) / 2, count: 61
  }
  if (![x1,y1,x2,y2].every(Number.isFinite) ||
    x1 < surface.originX || x2 < surface.originX || x1 > surface.right || x2 > surface.right ||
    y1 < surface.originY || y2 < surface.originY || y1 > surface.top || y2 > surface.top ||
    !Number.isInteger(count) || count < 2 || count > 500) {
    throw new InputError('测线端点必须在格网内，采样点数应为 2–500。')
  }
  const length = Math.hypot(x2 - x1, y2 - y1)
  if (!length) throw new InputError('测线的两个端点应不同。')
  return { x1, y1, x2, y2, length, count }
}
