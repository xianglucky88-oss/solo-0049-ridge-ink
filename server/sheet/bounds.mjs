import { InputError } from '../http/error.mjs'

export function sheetBounds(surface, value) {
  if (value == null) return { left: 0, bottom: 0, right: surface.right, top: surface.top }
  const { left, bottom, right, top } = value
  if (![left,bottom,right,top].every(Number.isFinite) || left < 0 || bottom < 0 ||
    right > surface.right || top > surface.top || right - left < 0.001 || top - bottom < 0.001) {
    throw new InputError('选幅需在格网内，且两个轴上的宽度均不能为零。')
  }
  return { left, bottom, right, top }
}
