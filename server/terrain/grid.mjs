import { InputError } from '../http/error.mjs'

export function grid(input) {
  const { width, height, unit, elevations } = input ?? {}
  if (![width, height].every(n => Number.isInteger(n) && n >= 2 && n <= 100) ||
    !Number.isFinite(unit) || unit < 0.1 || unit > 10000 ||
    !Array.isArray(elevations) || elevations.length !== width * height ||
    !elevations.every(n => n === null || Number.isFinite(n) && Math.abs(n) <= 50000)) {
    throw new InputError('需要 2–100 列和行、有效格距以及与格点数一致的高程数组。')
  }
  const vertices = elevations.map((z, id) => ({ id, z, x: id % width * unit, y: Math.floor(id / width) * unit }))
  return { width, height, unit, vertices, right: (width - 1) * unit, top: (height - 1) * unit }
}
