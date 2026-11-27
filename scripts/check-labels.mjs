// 高程标注规则的有界生产检查：闭环识别、自动标注确定性、避让、手动规则、导出一致。
import { compose } from '../server/sheet/compose.mjs'
import { classifyLines } from '../server/sheet/loops.mjs'

const check = (condition, message) => {
  if (!condition) {
    console.error(`标注检查失败：${message}`)
    process.exit(1)
  }
}

// 分岔绕回的线不能当作独立闭环。
{
  const point = (id, x, y) => ({ id, x, y })
  const [a, b, c, d, e] = [point('a', 0, 0), point('b', 1, 0), point('c', 0, 1), point('d', 2, 0), point('e', 2, 1)]
  const figure = [a, b, c, a, b, d, e, b]
  const clean = [point('p', 0, 0), point('q', 1, 0), point('r', 1, 1), point('p', 0, 0)]
  const classified = classifyLines([figure, clean], [[figure], [clean]])
  check(classified[0].closed === false && classified[1].closed === true, '分岔绕回线被误判为独立闭环')
}

// 圆锥地形：完整闭环自动标注、图框切开后外圈不再计数。
const size = 9
const elevations = []
for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
  elevations.push(Math.round(400 - Math.hypot(x - 4, y - 4) * 40))
}
const grid = { width: size, height: size, unit: 10, elevations }
const full = compose({ grid, interval: 20 })
check(full.labels.length > 0, '完整闭环未产生自动标注')
check(compose({ grid, interval: 20 }).svg === full.svg, '相同输入的自动标注位置不确定')
const cropped = compose({ grid, interval: 20, bounds: { left: 10, bottom: 10, right: 70, top: 70 } })
check(cropped.labels.every(label =>
  label.x >= 10 && label.x <= 70 && label.y >= 10 && label.y <= 70), '标注落到了图框外')
check(cropped.levels.every(level => level.labels <= level.loops), '标注数超过独立闭环数')

// 手动标注：合法落点确认，图框外拒绝，导出与确认图面一致。
const target = full.labels[0]
const move = { loopId: target.loopId, x: target.x, y: target.y }
const moved = compose({ grid, interval: 20, labels: [move] })
check(moved.labels.find(label => label.loopId === target.loopId)?.manual === true, '手动标注未标记为手动')
try {
  compose({ grid, interval: 20, labels: [{ loopId: target.loopId, x: -1, y: 0 }] })
  check(false, '图框外落点未被拒绝')
} catch (error) {
  check(error.status === 422, '图框外落点的错误状态不正确')
}
try {
  compose({ grid, interval: 20, labels: [{ loopId: 'missing', x: 1, y: 1 }] })
  check(false, '未知闭环未被拒绝')
} catch (error) {
  check(error.status === 400, '未知闭环的错误状态不正确')
}
const exported = compose({ grid, interval: 20, labels: [move] })
check(exported.svg === moved.svg, '导出 SVG 与确认图面不一致')

console.log(`标注检查通过：${full.labels.length} 个自动标注，图框内 ${cropped.labels.length} 个`)
