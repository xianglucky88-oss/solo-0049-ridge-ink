import { incident } from './incident.mjs'

export function heightAt(surface, x, y) {
  if (x < surface.originX || y < surface.originY || x > surface.right || y > surface.top) return null
  const surfacePoint = incident(surface, x, y)
  if (!surfacePoint) return null
  const { triangle, weights } = surfacePoint
  return triangle.reduce((sum, point, index) => sum + weights[index] * point.z, 0)
}
