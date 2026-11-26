import { heightAt } from '../terrain/height.mjs'

export function samples(surface, section) {
  const { x1, y1, x2, y2, length, count } = section
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const x = (1 - t) * x1 + t * x2, y = (1 - t) * y1 + t * y2
    return { distance: length * t, z: heightAt(surface, x, y) }
  })
}
