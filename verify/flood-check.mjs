import { compose } from '../server/sheet/compose.mjs'
import { wetComponents } from '../server/water/label.mjs'
import { grid as buildGrid } from '../server/terrain/grid.mjs'
import { triangles } from '../server/terrain/mesh.mjs'
import { flood } from '../server/water/flood.mjs'
import { facesAt } from '../server/water/locate.mjs'

let failures = 0
const check = (name, condition) => {
  if (condition) console.log(`  ✓ ${name}`)
  else { failures++; console.error(`  ✗ ${name}`) }
}
const expectError = (name, fn, fragment) => {
  try { fn(); failures++; console.error(`  ✗ ${name}（未拒绝）`) }
  catch (error) { check(name, error.message.includes(fragment)) }
}

// 5×3 格网：西、东两片低地，中间一列脊线/缺测
function ridgeGrid(column2) {
  const width = 5, height = 3
  const elevations = []
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (x <= 1) elevations.push(0)
    else if (x === 2) elevations.push(column2(y))
    else elevations.push(0)
  }
  return { width, height, unit: 10, elevations }
}
const level = 10
const west = { level, x: 5, y: 5 }
const east = { level, x: 35, y: 5 }

console.log('1) 山脊与水位窄坎隔离')
for (const [label, column2] of [
  ['高于水位的山脊', () => 20],
  ['恰好等于水位的窄坎', () => 10]
]) {
  const surface = buildGrid(ridgeGrid(column2))
  const mesh = triangles(surface)
  const a = flood(surface, mesh, west), b = flood(surface, mesh, east)
  check(`${label}两侧低地互不相通`, a.componentId !== b.componentId)
}

console.log('2) 共边存在低于水位一段时相通')
const breached = ridgeGrid(y => (y === 1 ? 5 : 10))
{
  const surface = buildGrid(breached)
  const mesh = triangles(surface)
  const a = flood(surface, mesh, west), b = flood(surface, mesh, east)
  check('降低一个脊线顶点后两片低地连通', a.componentId === b.componentId)
  check('连通后入水范围覆盖两侧低地', a.rings.flat().some(p => p.x > 30) && a.rings.flat().some(p => p.x < 20))
}

console.log('3) 缺测区隔断')
{
  const g = ridgeGrid(() => null)
  const surface = buildGrid(g)
  const mesh = triangles(surface)
  const a = flood(surface, mesh, west), b = flood(surface, mesh, east)
  check('缺测列两侧低地互不相通', a.componentId !== b.componentId)
  expectError('点在缺测区被拒绝', () => flood(surface, mesh, { level, x: 21, y: 5 }), '有效三角面')
}

console.log('4) 仅顶点碰头的多片低地')
{
  const g = { width: 3, height: 3, unit: 10, elevations: [
    0, 20, 20,
    20, 10, 20,
    20, 20, 0
  ] }
  const surface = buildGrid(g)
  const mesh = triangles(surface)
  const { groups } = wetComponents(mesh, level)
  check('形成两片只在中心顶点相邻的低地', groups.length === 2)
  expectError('点在碰头顶点要求重新选点', () => flood(surface, mesh, { level, x: 10, y: 10 }), '顶点')
  check('低地内部可选点', flood(surface, mesh, { level, x: 2, y: 2 }).faces > 0)
  check('另一低地内部可选点', flood(surface, mesh, { level, x: 18, y: 18 }).faces > 0)
}

console.log('5) 无效起点反馈')
{
  const surface = buildGrid(ridgeGrid(() => 20))
  const mesh = triangles(surface)
  expectError('格网外的点被拒绝', () => flood(surface, mesh, { level, x: -1, y: 5 }), '格网范围')
  // 旱地内部点：整块高地都高于水位，取中心格点附近
  const dryGrid = buildGrid({ width: 3, height: 3, unit: 10,
    elevations: [20, 20, 20, 20, 20, 20, 20, 20, 20] })
  expectError('高于水位的点被拒绝', () => flood(dryGrid, triangles(dryGrid), { level, x: 10, y: 10 }), '低洼处')
  const flat = buildGrid({ width: 2, height: 2, unit: 10, elevations: [10, 10, 10, 10] })
  expectError('恰好位于水位的点被拒绝', () => flood(flat, triangles(flat), { level, x: 5, y: 5 }), '不低于')
  // 格网存在有效面，但目标点所在格子的顶点全部缺测
  const nullGrid = buildGrid({ width: 3, height: 3, unit: 10,
    elevations: [null, null, 0, null, null, 0, 0, 0, 0] })
  expectError('无有效面支撑的点被拒绝', () => flood(nullGrid, triangles(nullGrid), { level, x: 5, y: 15 }), '有效三角面')
  expectError('缺少水位参数被拒绝', () => flood(surface, mesh, { x: 5, y: 5 }), '水位')
}

console.log('6) 格点/共边上的合法起点不产生误报')
{
  const surface = buildGrid(breached)
  const mesh = triangles(surface)
  const atVertex = flood(surface, mesh, { level, x: 0, y: 0 })
  const onEdge = flood(surface, mesh, { level, x: 10, y: 5 })
  check('低地格点可选点', atVertex.faces > 0)
  check('低地共边上可选点', onEdge.componentId === atVertex.componentId)
  check('候选面枚举覆盖格点周围全部面', facesAt(surface, 0, 0).length >= 2)
}

console.log('7) 选幅只裁剪显示，不改变连通范围')
{
  const data = { grid: breached, water: west }
  const full = compose(data)
  const cropped = compose({ ...data, bounds: { left: 25, bottom: 0, right: 40, top: 20 } })
  check('裁剪前后 rings 完全一致', JSON.stringify(full.water.rings) === JSON.stringify(cropped.water.rings))
  check('入水坐标原样保留', cropped.water.entry.x === 5 && cropped.water.entry.y === 5)
  check('裁掉的入水点不出现在图面坐标中', !cropped.svg.includes('data-entry="1" cx="0"'))
  check('图幅内仍显示绕行可达的另一侧填色', cropped.svg.includes('data-water'))
  const again = compose(data)
  check('同输入 SVG 可重复', full.svg === again.svg)
}

console.log('8) 矢量图与接口输出')
{
  const sheet = compose({ grid: breached, water: west })
  check('SVG 含积水填色层', sheet.svg.includes('data-water="10"'))
  check('SVG 含入水点标记', sheet.svg.includes('data-entry="1"'))
  check('SVG 含图幅裁剪路径', sheet.svg.includes('water-clip'))
  check('JSON 返回地面坐标环与起点', sheet.water.rings.length > 0 && sheet.water.entry.x === 5)
  const plain = compose({ grid: breached })
  check('不带 water 时输出与旧结构兼容', !plain.svg.includes('data-water') && plain.water === null)
}

console.log('9) 填色几何不越过水位线')
{
  const surface = buildGrid(breached)
  const mesh = triangles(surface)
  const result = flood(surface, mesh, west)
  const allPoints = result.rings.flat()
  check('环上所有点位于格网内', allPoints.every(p => p.x >= 0 && p.x <= 40 && p.y >= 0 && p.y <= 20))
  // 环上格点高程不得低于…湿区边界只能由水位交点和 z>=level 的顶点组成
  // 内部边界格点（非格网外缘）不得低于水位：低点都在填色内部，外缘低顶点允许作为水域边界
  const lowVertexOnBoundary = allPoints.some(p => {
    const onGridX = Number.isInteger(p.x / 10), onGridY = Number.isInteger(p.y / 10)
    if (!onGridX || !onGridY) return false
    if (p.x === 0 || p.y === 0 || p.x === surface.right || p.y === surface.top) return false
    const id = (p.y / 10) * 5 + p.x / 10
    return breached.elevations[id] < level
  })
  check('边界不出现低于水位的格点（低点都在填色内部）', !lowVertexOnBoundary)
}

if (failures) { console.error(`\n${failures} 项验证失败`); process.exit(1) }
console.log('\n全部积水连通规则验证通过')
