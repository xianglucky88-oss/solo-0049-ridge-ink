import { InputError } from '../http/error.mjs'
import { facesAt } from './locate.mjs'
import { wetComponents, faceId } from './label.mjs'
import { componentRings } from './rings.mjs'

export function flood(surface, mesh, input) {
  const { level, x, y } = input ?? {}
  if (![level, x, y].every(Number.isFinite)) {
    throw new InputError('积水分析需要给定水位以及入水位置的东、北地面坐标。')
  }
  if (x < 0 || y < 0 || x > surface.right || y > surface.top) {
    throw new InputError('入水位置落在格网范围之外，无法作为起点。')
  }
  const candidates = facesAt(surface, x, y)
  if (!candidates.length) {
    throw new InputError('该位置没有有效三角面支撑（缺测区或留白），请重新选择入水位置。')
  }
  const { component, groups } = wetComponents(mesh, level)
  const faceIndexOf = new Map(mesh.map((triangle, index) => [faceId(triangle), index]))
  const wetCandidates = candidates.filter(item => item.triangle.some(vertex => vertex.z < level))
  if (!wetCandidates.length) {
    // 覆盖该点的所有面都没有低于水位的顶点，插值地面必然不低于水位
    throw new InputError('该位置地面不低于给定水位，请在低洼处重新选择入水位置。')
  }
  const memberIds = new Set(wetCandidates.map(item => component[faceIndexOf.get(faceId(item.triangle))]))
  if (memberIds.size > 1) {
    throw new InputError('该点只在顶点处同时接触几片互不相通的低地，请在低地内部重新选择入水位置。')
  }
  const componentId = memberIds.values().next().value
  const faces = groups[componentId]
  const rings = componentRings(mesh, faces, level)
  const marker = { x, y }
  return {
    level, entry: marker, componentId,
    faces: faces.length,
    rings: rings.map(ring => ring.map(({ x: rx, y: ry }) => ({ x: rx, y: ry }))),
    marker
  }
}
