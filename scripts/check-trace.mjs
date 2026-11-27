import { compose } from '../server/sheet/compose.mjs'
import { demo } from '../server/terrain/demo.mjs'

const assert = (condition, message) => {
  if (!condition) { console.error(`trace 检查失败：${message}`); process.exit(1) }
}

// 示例地形，测线穿过缺测洞。
const grid = demo()
const section = { x1: 0, y1: 140, x2: 540, y2: 140, count: 61 }
const sheet = compose({ grid, section })
assert(Array.isArray(sheet.trace.segments) && Array.isArray(sheet.trace.gaps) &&
  Array.isArray(sheet.trace.isolated), 'trace 应包含 segments、gaps、isolated')
assert(sheet.profile.length === 61 && sheet.profile.at(-1).distance === 540 &&
  sheet.profile.some(p => p.z === null), '等距剖面保持原约定')
assert(sheet.trace.gaps.length === 1 && sheet.trace.gaps[0].end > sheet.trace.gaps[0].start,
  '应识别出缺测区间及其起止里程')

// 改测点数只改等距测点，trace 不变。
assert(JSON.stringify(sheet.trace) ===
  JSON.stringify(compose({ grid, section: { ...section, count: 11 } }).trace), '测点数不应改变 trace')

// 起终点对调：里程镜像，地面位置与高程不变。
const reversed = compose({ grid, section: { x1: 540, y1: 140, x2: 0, y2: 140, count: 37 } }).trace
const forwardPoints = sheet.trace.segments.flatMap(s => s.points).map(p => p.distance).sort((a, b) => a - b)
const mirroredPoints = reversed.segments.flatMap(s => s.points).map(p => 540 - p.distance).sort((a, b) => a - b)
assert(forwardPoints.length === mirroredPoints.length &&
  forwardPoints.every((d, i) => Math.abs(d - mirroredPoints[i]) < 1e-6), '对调后坡折位置应镜像一致')
assert(reversed.gaps.length === sheet.trace.gaps.length &&
  Math.abs(reversed.gaps[0].start - (540 - sheet.trace.gaps[0].end)) < 1e-6 &&
  Math.abs(reversed.gaps[0].end - (540 - sheet.trace.gaps[0].start)) < 1e-6, '对调后缺测区间应镜像一致')

// 选幅只取测线中间一段，剖面仍覆盖完整测线。
const cropped = compose({ grid, bounds: { left: 40, bottom: 40, right: 450, top: 370 }, section })
assert(JSON.stringify(cropped.trace) === JSON.stringify(sheet.trace) &&
  cropped.profile.at(-1).distance === 540, '选幅不应改变剖面')

// 孤立读数：只有三角面 [0,1,4] 有效，测线仅在顶点 (10,10) 相触。
const isolatedGrid = { width: 3, height: 3, unit: 10,
  elevations: [0, 10, null, null, 20, null, null, null, null] }
const isolated = compose({ grid: isolatedGrid, interval: 5,
  section: { x1: 0, y1: 10, x2: 20, y2: 10, count: 21 } }).trace
assert(isolated.segments.length === 0 && isolated.isolated.length === 1 &&
  Math.abs(isolated.isolated[0].distance - 10) < 1e-9 && isolated.isolated[0].z === 20 &&
  isolated.gaps.length === 2, '孤立读数应单独标出且两侧缺测断开')

console.log(`trace 检查通过：${sheet.trace.segments.length} 段折线、${sheet.trace.gaps.length} 段缺测、` +
  `${isolated.isolated.length} 个孤立读数`)
