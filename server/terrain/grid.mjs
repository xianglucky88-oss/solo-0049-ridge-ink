import { InputError } from '../http/error.mjs'

export function grid(input) {
  const { width, height, unit, elevations } = input ?? {}
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 100) ||
    !Number.isFinite(unit) || unit < 0.1 || unit > 10000 ||
    !Array.isArray(elevations) || elevations.length !== width * height ||
    !elevations.every(n => n === null || Number.isFinite(n) && Math.abs(n) <= 50000)) {
    throw new InputError('需要 2–100 列和行、有效格距以及与格点数一致的高程数组。')
  }
  const originX = input.originX ?? input.origin?.x ?? 0
  const originY = input.originY ?? input.origin?.y ?? 0
  if (!Number.isFinite(originX) || !Number.isFinite(originY) || Math.abs(originX) > 1000000 || Math.abs(originY) > 1000000) {
    throw new InputError('格网西南起点需要为有效的米制坐标。')
  }
  const vertices = elevations.map((z, id) => ({ id, z, x: originX + id % width * unit, y: originY + Math.floor(id / width) * unit }))
  return { width, height, unit, originX, originY, vertices,
    right: originX + (width - 1) * unit, top: originY + (height - 1) * unit }
}
