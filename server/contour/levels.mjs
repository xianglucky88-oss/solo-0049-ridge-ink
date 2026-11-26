import { InputError } from '../http/error.mjs'

export function levels(mesh, interval, offset) {
  if (!Number.isFinite(interval) || interval < 0.1 || interval > 50000 ||
    !Number.isFinite(offset) || Math.abs(offset) > 50000) throw new InputError('等高距必须大于等于 0.1 米，基准高程需要为有限值。')
  if (!mesh.length) throw new InputError('格网没有可用的三角面。', 422)
  let low = Infinity, high = -Infinity
  for (const triangle of mesh) for (const { z } of triangle) {
    low = Math.min(z, low)
    high = Math.max(z, high)
  }
  const start = Math.ceil((low - offset) / interval)
  const end = Math.floor((high - offset) / interval)
  if (end - start + 1 > 100) throw new InputError('等高线级数超过 100，请增大等高距。', 422)
  return Array.from({ length: end - start + 1 }, (_, i) => offset + (start + i) * interval)
}
