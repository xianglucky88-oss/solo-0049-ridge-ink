import { InputError } from '../http/error.mjs'

export function sheetBounds(surface, value) {
  if (value == null) return { left: surface.originX, bottom: surface.originY, right: surface.right, top: surface.top }
  const { left, bottom, right, top } = value
  if (![left,bottom,right,top].every(Number.isFinite) ||
    left < surface.originX - 1e-9 || bottom < surface.originY - 1e-9 ||
    right > surface.right + 1e-9 || top > surface.top + 1e-9 ||
    right - left < 0.001 || top - bottom < 0.001) {
    throw new InputError('选幅需在现状格网内，且两个轴上的宽度均不能为零。')
  }
  return { left, bottom, right, top }
}
